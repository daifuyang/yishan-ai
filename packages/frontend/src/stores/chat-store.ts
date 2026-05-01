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
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
}

interface ChatStore {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  activeToolCalls: ToolCall[];
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
  activeToolCalls: [],
  currentEventSource: null,

  fetchMessages: async (sessionId) => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
    const data = await res.json();

    if (data.messages) {
      const messages: Message[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
          : m.content,
        toolCalls: m.toolCalls,
      }));
      set({ messages });
    }

    if (data.session?.status === 'streaming') {
      set({ isStreaming: true, streamingContent: data.session.streamingContent || '' });
      get().subscribe(sessionId);
    }
  },

  sendMessage: async (sessionId, content, model, mode) => {
    const tempId = crypto.randomUUID();
    set({ isStreaming: true, streamingContent: '', activeToolCalls: [], messages: [
      ...get().messages,
      { id: tempId, role: 'user', content }
    ]});

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

    get().subscribe(sessionId);
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
        set((state) => ({
          activeToolCalls: [
            ...state.activeToolCalls,
            {
              id: crypto.randomUUID(),
              name: data.data.tool,
              input: data.data.args || {},
              status: 'running',
            },
          ],
        }));
      } else if (data.type === 'tool_result') {
        set((state) => ({
          activeToolCalls: state.activeToolCalls.map((tc, idx) =>
            idx === state.activeToolCalls.length - 1
              ? { ...tc, status: 'completed' as const, output: data.data.result }
              : tc
          ),
        }));
      } else if (data.type === 'tool_error') {
        set((state) => ({
          activeToolCalls: state.activeToolCalls.map((tc, idx) =>
            idx === state.activeToolCalls.length - 1
              ? { ...tc, status: 'error' as const, error: data.data.error }
              : tc
          ),
        }));
      } else if (data.type === 'message_stop') {
        set((state) => {
          const lastMsg = state.messages[state.messages.length - 1];
          const toolCalls = state.activeToolCalls.length > 0 ? state.activeToolCalls : lastMsg?.toolCalls;
          let messages;
          if (lastMsg?.role === 'assistant') {
            messages = state.messages.map((msg, idx) =>
              idx === state.messages.length - 1
                ? { ...msg, content: state.streamingContent, toolCalls }
                : msg
            );
          } else if (state.streamingContent) {
            messages = [
              ...state.messages,
              { id: crypto.randomUUID(), role: 'assistant' as const, content: state.streamingContent, toolCalls }
            ];
          } else {
            messages = state.messages;
          }
          return { messages, isStreaming: false, streamingContent: '', activeToolCalls: [], currentEventSource: null };
        });
        eventSource.close();
      } else if (data.type === 'error') {
        set({ isStreaming: false, streamingContent: '', activeToolCalls: [], currentEventSource: null });
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
      set({ currentEventSource: null, isStreaming: false, streamingContent: '', activeToolCalls: [] });
    }
  },

  stopStream: async (sessionId) => {
    const eventSource = get().currentEventSource;
    if (eventSource) {
      eventSource.close();
    }
    await fetch(`${API_BASE}/api/sessions/${sessionId}/chat/stop`, { method: 'POST' });
    set({ isStreaming: false, streamingContent: '', activeToolCalls: [], currentEventSource: null });
  },

  clearMessages: () => set({ messages: [], isStreaming: false, streamingContent: '', activeToolCalls: [] }),

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
    set({ messages: newMessages, isStreaming: false, streamingContent: '', activeToolCalls: [], currentEventSource: null });

    return targetMsg.content;
  },
}));