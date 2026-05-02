import { create } from 'zustand';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  type: 'user' | 'assistant' | 'final';
  content: string | ContentBlock[];
  thinking?: string;
  toolCalls?: ToolCall[];
}

export interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
}

interface ChatStore {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  currentEventSource: EventSource | null;
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string, model: string, mode?: 'plan' | 'build') => Promise<void>;
  subscribe: (sessionId: string) => void;
  unsubscribe: () => void;
  stopStream: (sessionId: string) => Promise<void>;
  clearMessages: () => void;
  rollbackMessage: (sessionId: string, messageId: string) => Promise<string | null>;
}

const API_BASE = '';

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  currentEventSource: null,

  fetchMessages: async (sessionId) => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
    const data = await res.json();

    if (data.messages) {
      const messages: Message[] = data.messages.map((m: any) => {
        let content: string | ContentBlock[];
        let toolCalls: ToolCall[] | undefined;

        if (Array.isArray(m.content)) {
          content = m.content.map((c: any) => {
            if (c.type === 'tool_use') {
              toolCalls = toolCalls || [];
              toolCalls.push({
                id: c.id,
                name: c.name,
                input: c.input || {},
                output: c.result,
                error: c.error,
                status: c.error ? 'error' : 'completed',
              });
            }
            return c;
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
        };
      });
      set({ messages });
    }

    if (data.session?.status === 'streaming') {
      set({ isStreaming: true, streamingContent: data.session.streamingContent || '' });
      get().subscribe(sessionId);
    }
  },

  sendMessage: async (sessionId, content, model, mode) => {
    const tempId = crypto.randomUUID();
    set({ isStreaming: true, streamingContent: '', messages: [
      ...get().messages,
      { id: tempId, role: 'user', type: 'user', content }
    ]});

    const existingSource = get().currentEventSource;
    if (existingSource) {
      existingSource.close();
    }

    const eventSource = new EventSource(`${API_BASE}/api/sessions/${sessionId}/chat/subscribe`);
    set({ currentEventSource: eventSource });

    let onMessageHandler: ((event: MessageEvent) => void) | null = null;

    const messageHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'stream_started') {
        return;
      }

      if (data.type === 'content_catchup') {
        set({ streamingContent: data.content });
      } else if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        set((state) => ({
          streamingContent: state.streamingContent + data.delta.text,
        }));
      } else if (data.type === 'tool_call') {
        const toolUseBlock: ContentBlock = {
          type: 'tool_use',
          id: crypto.randomUUID(),
          name: data.data.tool,
          input: data.data.args || {},
        };
        set((state) => {
          const lastMsg = state.messages[state.messages.length - 1];
          if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
            const existingToolUse = lastMsg.content.find(
              (c: ContentBlock) => c.type === 'tool_use' && c.name === toolUseBlock.name && JSON.stringify(c.input) === JSON.stringify(toolUseBlock.input)
            );
            if (existingToolUse) {
              return {};
            }
            const updatedContent: ContentBlock[] = [...lastMsg.content, toolUseBlock];
            return {
              messages: state.messages.map((msg, idx) =>
                idx === state.messages.length - 1
                  ? { ...msg, content: updatedContent }
                  : msg
              ),
            };
          }
          return {
            messages: [
              ...state.messages,
              {
                id: crypto.randomUUID(),
                role: 'assistant' as const,
                type: 'assistant' as const,
                content: [toolUseBlock],
              },
            ],
          };
        });
      } else if (data.type === 'tool_result') {
        set((state) => {
          const messages = [...state.messages];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              const toolUseBlock = msg.content.find((c: ContentBlock) => c.type === 'tool_use' && !c.result);
              if (toolUseBlock) {
                toolUseBlock.result = data.data.result;
                break;
              }
            }
          }
          return { messages };
        });
      } else if (data.type === 'tool_error') {
        set((state) => {
          const messages = [...state.messages];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              const toolUseBlock = msg.content.find((c: ContentBlock) => c.type === 'tool_use' && !c.error);
              if (toolUseBlock) {
                toolUseBlock.error = data.data.error;
                break;
              }
            }
          }
          return { messages };
        });
      } else if (data.type === 'message_stop') {
        set((state) => {
          const lastMsg = state.messages[state.messages.length - 1];
          let messages: Message[];
          if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
            const textBlock: ContentBlock = { type: 'text', text: state.streamingContent };
            const newContent = [...lastMsg.content, textBlock];
            messages = state.messages.map((msg, idx) =>
              idx === state.messages.length - 1
                ? { ...msg, type: 'final' as const, content: newContent }
                : msg
            ) as Message[];
          } else if (state.streamingContent) {
            messages = [
              ...state.messages,
              { id: crypto.randomUUID(), role: 'assistant' as const, type: 'final' as const, content: state.streamingContent }
            ];
          } else {
            messages = state.messages;
          }
          return { messages, isStreaming: false, streamingContent: '', currentEventSource: null };
        });
        eventSource.close();
      } else if (data.type === 'error') {
        set({ isStreaming: false, streamingContent: '', currentEventSource: null });
        eventSource.close();
      }
    };

    eventSource.onmessage = messageHandler;

    eventSource.onerror = () => {
      eventSource.close();
      set({ isStreaming: false, currentEventSource: null });
    };

    await new Promise<void>((resolve) => {
      eventSource.onopen = () => {
        setTimeout(resolve, 50);
      };
    });

    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, model, mode }),
    });
    const data = await res.json();

    if (data.messageId) {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === tempId ? { ...msg, id: data.messageId } : msg
        ),
      }));
    }
  },

  subscribe: (sessionId) => {
    const existingSource = get().currentEventSource;
    if (existingSource) {
      existingSource.close();
    }

    const eventSource = new EventSource(`${API_BASE}/api/sessions/${sessionId}/chat/subscribe`);
    set({ currentEventSource: eventSource });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'content_catchup') {
        set({ streamingContent: data.content });
      } else if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        set((state) => ({
          streamingContent: state.streamingContent + data.delta.text,
        }));
      } else if (data.type === 'tool_call') {
        const toolUseBlock: ContentBlock = {
          type: 'tool_use',
          id: crypto.randomUUID(),
          name: data.data.tool,
          input: data.data.args || {},
        };
        set((state) => {
          const lastMsg = state.messages[state.messages.length - 1];
          if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
            const existingToolUse = lastMsg.content.find(
              (c: ContentBlock) => c.type === 'tool_use' && c.name === toolUseBlock.name && JSON.stringify(c.input) === JSON.stringify(toolUseBlock.input)
            );
            if (existingToolUse) {
              return {};
            }
            const updatedContent: ContentBlock[] = [...lastMsg.content, toolUseBlock];
            return {
              messages: state.messages.map((msg, idx) =>
                idx === state.messages.length - 1
                  ? { ...msg, content: updatedContent }
                  : msg
              ),
            };
          }
          return {
            messages: [
              ...state.messages,
              {
                id: crypto.randomUUID(),
                role: 'assistant' as const,
                type: 'assistant' as const,
                content: [toolUseBlock],
              },
            ],
          };
        });
      } else if (data.type === 'tool_result') {
        set((state) => {
          const messages = [...state.messages];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              const toolUseBlock = msg.content.find((c: ContentBlock) => c.type === 'tool_use' && !c.result);
              if (toolUseBlock) {
                toolUseBlock.result = data.data.result;
                break;
              }
            }
          }
          return { messages };
        });
      } else if (data.type === 'tool_error') {
        set((state) => {
          const messages = [...state.messages];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              const toolUseBlock = msg.content.find((c: ContentBlock) => c.type === 'tool_use' && !c.error);
              if (toolUseBlock) {
                toolUseBlock.error = data.data.error;
                break;
              }
            }
          }
          return { messages };
        });
      } else if (data.type === 'message_stop') {
        set((state) => {
          const lastMsg = state.messages[state.messages.length - 1];
          let messages: Message[];
          if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
            const textBlock: ContentBlock = { type: 'text', text: state.streamingContent };
            const newContent = [...lastMsg.content, textBlock];
            messages = state.messages.map((msg, idx) =>
              idx === state.messages.length - 1
                ? { ...msg, type: 'final' as const, content: newContent }
                : msg
            ) as Message[];
          } else if (state.streamingContent) {
            messages = [
              ...state.messages,
              { id: crypto.randomUUID(), role: 'assistant' as const, type: 'final' as const, content: state.streamingContent }
            ];
          } else {
            messages = state.messages;
          }
          return { messages, isStreaming: false, streamingContent: '', currentEventSource: null };
        });
        eventSource.close();
      } else if (data.type === 'error') {
        set({ isStreaming: false, streamingContent: '', currentEventSource: null });
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      set({ isStreaming: false, streamingContent: '', currentEventSource: null });
    };
  },

  unsubscribe: () => {
    const eventSource = get().currentEventSource;
    if (eventSource) {
      eventSource.close();
      set({ currentEventSource: null, isStreaming: false, streamingContent: '' });
    }
  },

  stopStream: async (sessionId) => {
    const eventSource = get().currentEventSource;
    if (eventSource) {
      eventSource.close();
    }
    await fetch(`${API_BASE}/api/sessions/${sessionId}/chat/stop`, { method: 'POST' });
    set({ isStreaming: false, streamingContent: '', currentEventSource: null });
  },

  clearMessages: () => set({ messages: [], isStreaming: false, streamingContent: '' }),

  rollbackMessage: async (sessionId, messageId) => {
    const state = get();
    const msgIndex = state.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return null;

    const targetMsg = state.messages[msgIndex];
    if (targetMsg.role !== 'user') return null;

    const existingSource = state.currentEventSource;
    if (existingSource) {
      existingSource.close();
    }

    await fetch(`${API_BASE}/api/sessions/${sessionId}/messages?from=${messageId}`, {
      method: 'DELETE',
    });

    const newMessages = state.messages.slice(0, msgIndex);
    set({ messages: newMessages, isStreaming: false, streamingContent: '', currentEventSource: null });

    return typeof targetMsg.content === 'string' ? targetMsg.content : JSON.stringify(targetMsg.content);
  },
}));