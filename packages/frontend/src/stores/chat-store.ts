import { create } from 'zustand';
import { apiUrl } from '@/lib/api-base';
import { applyEvent, type ChatState, msgId } from '@/lib/message-reducer';
import {
  type AgentEvent,
  connectToSession,
  type SSEConnection,
  type SSEHandlers,
} from '@/lib/sse-client';
import type {
  ActiveStream,
  ContentBlock,
  Message,
  RawAPIMessage,
  RawContentBlock,
  ToolCall,
} from '@/types';

const MESSAGES_KEY = 'yishan-messages';

interface ChatStore extends ChatState {
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (
    sessionId: string,
    content: string,
    model: string
  ) => Promise<{ success: boolean; error?: string }>;
  retryMessage: (
    sessionId: string,
    messageId: string,
    model: string
  ) => Promise<{ success: boolean; error?: string }>;
  subscribe: (sessionId: string) => void;
  unsubscribe: () => void;
  stopStream: (sessionId: string) => Promise<void>;
  clearMessages: () => void;
  updateMessageStatus: (
    messageId: string,
    status: 'pending' | 'success' | 'failed' | 'stopped',
    error?: string
  ) => void;
  rollbackMessage: (sessionId: string, messageId: string) => Promise<string | null>;
  handleAgentEvent: (event: AgentEvent) => void;
  saveMessages: () => void;
  loadMessages: () => void;
  clearStoredMessages: () => void;
}

let connection: SSEConnection | null = null;

function disconnect() {
  connection?.disconnect();
  connection = null;
}

function buildSSEHandlers(): SSEHandlers {
  return {
    content_catchup: (e) => useChatStore.getState().handleAgentEvent(e),
    content_block_delta: (e) => useChatStore.getState().handleAgentEvent(e),
    tool_call: (e) => useChatStore.getState().handleAgentEvent(e),
    tool_result: (e) => useChatStore.getState().handleAgentEvent(e),
    tool_error: (e) => useChatStore.getState().handleAgentEvent(e),
    message_stop: (e) => {
      useChatStore.getState().handleAgentEvent(e);
      disconnect();
    },
    error: (e) => {
      useChatStore.getState().handleAgentEvent(e);
      disconnect();
    },
  };
}

function connect(sessionId: string) {
  disconnect();
  connection = connectToSession(sessionId, buildSSEHandlers());
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  messages: [] as Message[],
  isStreaming: false,
  isFetchingMessages: false,
  streamingContent: '',
  pendingMessageId: null as string | null,
  activeStream: null as ActiveStream | null,

  handleAgentEvent: (event: AgentEvent) => {
    set((state) => applyEvent(state, event));
  },

  saveMessages: () => {
    const state = get();
    if (typeof window !== 'undefined' && state.messages.length > 0) {
      sessionStorage.setItem(
        MESSAGES_KEY,
        JSON.stringify({
          messages: state.messages,
          pendingMessageId: state.pendingMessageId,
          isStreaming: state.isStreaming,
          activeStream: state.activeStream,
        })
      );
    }
  },

  loadMessages: () => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem(MESSAGES_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        set({
          messages: data.messages || [],
          pendingMessageId: data.pendingMessageId || null,
          isStreaming: data.isStreaming || false,
          activeStream: data.activeStream || null,
        });
      } catch (_e) {
        sessionStorage.removeItem(MESSAGES_KEY);
      }
    }
  },

  clearStoredMessages: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(MESSAGES_KEY);
    }
  },

  fetchMessages: async (sessionId) => {
    set({ isFetchingMessages: true });
    let fetchedMessages: Message[] = [];
    try {
      const res = await fetch(apiUrl(`/api/sessions/${sessionId}`));
      if (!res.ok) {
        throw new Error(`获取会话失败: ${res.status}`);
      }
      const data = await res.json();

      if (data.messages) {
        const toolResultsMap = new Map<string, { result?: string; error?: string }>();

        for (const m of data.messages) {
          if (m.role === 'tool' && Array.isArray(m.content)) {
            for (const c of m.content) {
              if (c.type === 'tool_result' && c.tool_use_id) {
                toolResultsMap.set(c.tool_use_id, {
                  result: c.content,
                  error: c.error,
                });
              }
            }
          }
        }

        const messages: Message[] = data.messages
          .filter((m: RawAPIMessage) => m.role !== 'tool')
          .map((m: RawAPIMessage) => {
            let content: string | ContentBlock[];
            let toolCalls: ToolCall[] | undefined;

            if (Array.isArray(m.content)) {
              content = m.content.map((c: RawContentBlock) => {
                if (c.type === 'tool_use') {
                  const toolResult = toolResultsMap.get(c.id || '');
                  toolCalls = toolCalls || [];
                  toolCalls.push({
                    id: c.id || msgId(),
                    name: c.name || 'unknown',
                    input: c.input || {},
                    output: toolResult?.result,
                    error: toolResult?.error,
                    status: toolResult?.error
                      ? 'error'
                      : toolResult?.result
                        ? 'completed'
                        : 'running',
                  });
                  return {
                    type: c.type as 'tool_use',
                    id: c.id,
                    name: c.name,
                    input: c.input,
                    result: toolResult?.result,
                    error: toolResult?.error,
                  } as ContentBlock;
                }
                return c as ContentBlock;
              });
            } else if (typeof m.content === 'string') {
              content = m.content;
            } else if (m.content && typeof m.content === 'object' && m.content.text) {
              content = m.content.text;
            } else {
              content = String(m.content);
            }

            return {
              id: m.id,
              role: m.role,
              type: m.type || (m.role === 'user' ? 'user' : 'assistant'),
              content,
              toolCalls,
              status: 'success' as const,
            };
          });
        fetchedMessages = messages;
        const currentMessages = get().messages;
        const hasPendingMessage = currentMessages.some((m) => m.status === 'pending');
        if (hasPendingMessage) {
          set({ isFetchingMessages: false });
        } else if (messages.length > 0) {
          set({ messages, isFetchingMessages: false });
        } else {
          set({ isFetchingMessages: false });
        }
        get().saveMessages();
      }

      if (data.session?.status === 'streaming') {
        const currentMessages = get().messages;
        const localAssistant = currentMessages.find(
          (m) => m.role === 'assistant' && m.status === 'pending'
        );
        const serverAssistant = (
          data.messages as Array<{ id: string; role: string; status?: string }>
        )?.find((m) => m.role === 'assistant');
        const assistantId = localAssistant?.id || serverAssistant?.id || null;
        if (!assistantId) {
          console.warn(
            '[fetchMessages] session is streaming but no assistant target found, fallback to non-streaming'
          );
          set({
            isStreaming: false,
            streamingContent: '',
            isFetchingMessages: false,
            pendingMessageId: null,
            activeStream: null,
          });
        } else {
          const sourceMessages = localAssistant ? currentMessages : fetchedMessages;
          const assistantIdx = sourceMessages.findIndex((m) => m.id === assistantId);
          const userId =
            assistantIdx > 0
              ? sourceMessages
                  .slice(0, assistantIdx)
                  .reverse()
                  .find((m) => m.role === 'user')?.id || null
              : null;
          set({
            isStreaming: true,
            streamingContent: data.session.streamingContent || '',
            isFetchingMessages: false,
            pendingMessageId: assistantId,
            activeStream: { sessionId, userId, assistantId },
          });
          get().subscribe(sessionId);
        }
      } else {
        set({
          isStreaming: false,
          streamingContent: '',
          isFetchingMessages: false,
          pendingMessageId: null,
          activeStream: null,
        });
      }
    } catch (_error) {
      set({ isFetchingMessages: false });
    }
  },

  sendMessage: async (sessionId, content, model) => {
    const userTempId = msgId();
    const assistantTempId = msgId();
    set((state) => ({
      isStreaming: true,
      streamingContent: '',
      pendingMessageId: assistantTempId,
      activeStream: { sessionId, userId: userTempId, assistantId: assistantTempId },
      messages: [
        ...state.messages,
        { id: userTempId, role: 'user', type: 'user', content, status: 'pending' as const, model },
        {
          id: assistantTempId,
          role: 'assistant',
          type: 'assistant',
          content: '',
          status: 'pending' as const,
        },
      ],
    }));

    connect(sessionId);

    try {
      const res = await fetch(apiUrl(`/api/sessions/${sessionId}/chat/stream`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, model }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: '请求失败' }));
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === userTempId || msg.id === assistantTempId
              ? {
                  ...msg,
                  status: 'failed' as const,
                  error: errorData.error || `错误 ${res.status}`,
                }
              : msg
          ),
          isStreaming: false,
          pendingMessageId: null,
          activeStream: null,
        }));
        disconnect();
        return { success: false, error: errorData.error || `错误 ${res.status}` };
      }

      const resData = await res.json();

      if (resData.messageId) {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === assistantTempId ? { ...msg, serverId: resData.messageId } : msg
          ),
        }));
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === userTempId || msg.id === assistantTempId
            ? { ...msg, status: 'failed' as const, error: errorMessage }
            : msg
        ),
        isStreaming: false,
        pendingMessageId: null,
        activeStream: null,
      }));
      disconnect();
      return { success: false, error: errorMessage };
    }
  },

  retryMessage: async (sessionId, messageId, model) => {
    const state = get();
    const msg = state.messages.find((m) => m.id === messageId);
    if (!msg || msg.role !== 'user') {
      return { success: false, error: '消息不存在' };
    }

    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const assistantTempId = msgId();

    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: assistantTempId,
          role: 'assistant',
          type: 'assistant',
          content: '',
          status: 'pending' as const,
        },
      ],
      isStreaming: true,
      pendingMessageId: assistantTempId,
      activeStream: { sessionId, userId: messageId, assistantId: assistantTempId },
    }));

    connect(sessionId);

    try {
      const res = await fetch(apiUrl(`/api/sessions/${sessionId}/chat/stream`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, model }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: '请求失败' }));
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantTempId
              ? { ...m, status: 'failed' as const, error: errorData.error || `错误 ${res.status}` }
              : m
          ),
          isStreaming: false,
          pendingMessageId: null,
          activeStream: null,
        }));
        disconnect();
        return { success: false, error: errorData.error || `错误 ${res.status}` };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantTempId ? { ...m, status: 'failed' as const, error: errorMessage } : m
        ),
        isStreaming: false,
        pendingMessageId: null,
        activeStream: null,
      }));
      disconnect();
      return { success: false, error: errorMessage };
    }
  },

  updateMessageStatus: (messageId, status, error) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, status, error } : msg
      ),
    }));
  },

  subscribe: (sessionId) => {
    const state = get();
    if (!state.activeStream?.assistantId) {
      console.warn('[subscribe] No activeStream, refusing to subscribe');
      return;
    }
    if (state.activeStream.sessionId !== sessionId) {
      console.warn('[subscribe] sessionId mismatch, refusing to subscribe');
      return;
    }
    connect(sessionId);
  },

  unsubscribe: () => {
    disconnect();
    set({ isStreaming: false, streamingContent: '', pendingMessageId: null, activeStream: null });
  },

  stopStream: async (sessionId) => {
    disconnect();
    try {
      await fetch(apiUrl(`/api/sessions/${sessionId}/chat/stop`), { method: 'POST' });
    } catch (_e) {
      // ignore stop errors
    }
    set((state) => {
      const assistantId = state.activeStream?.assistantId;
      const userId = state.activeStream?.userId;
      return {
        messages: state.messages.map((msg) =>
          msg.id === assistantId
            ? { ...msg, status: 'stopped' as const }
            : userId && msg.id === userId
              ? { ...msg, status: 'success' as const }
              : msg
        ),
        isStreaming: false,
        streamingContent: '',
        pendingMessageId: null,
        activeStream: null,
      };
    });
  },

  clearMessages: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('chat-storage');
    }
    return set({
      messages: [],
      isStreaming: false,
      isFetchingMessages: false,
      streamingContent: '',
      pendingMessageId: null,
      activeStream: null,
    });
  },

  rollbackMessage: async (sessionId, messageId) => {
    const state = get();
    const msgIndex = state.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return null;

    const targetMsg = state.messages[msgIndex];
    if (targetMsg.role !== 'user') return null;

    disconnect();

    try {
      await fetch(apiUrl(`/api/sessions/${sessionId}/messages?from=${messageId}`), {
        method: 'DELETE',
      });
    } catch (_e) {
      // ignore delete errors
    }

    const newMessages = state.messages.slice(0, msgIndex);
    set({
      messages: newMessages,
      isStreaming: false,
      streamingContent: '',
      pendingMessageId: null,
      activeStream: null,
    });

    return typeof targetMsg.content === 'string'
      ? targetMsg.content
      : JSON.stringify(targetMsg.content);
  },
}));
