import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
}

interface ChatStore {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  currentEventSource: EventSource | null;
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string, model: string, mode?: 'plan' | 'build') => Promise<void>;
  subscribe: (sessionId: string) => void;
  stopStream: (sessionId: string) => Promise<void>;
  clearMessages: () => void;
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
      const messages: Message[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
          : m.content,
      }));
      set({ messages });
    }

    if (data.session?.status === 'streaming') {
      set({ isStreaming: true, streamingContent: data.session.streamingContent || '' });
      get().subscribe(sessionId);
    }
  },

  sendMessage: async (sessionId, content, model, mode) => {
    set({ isStreaming: true, streamingContent: '', messages: [
      ...get().messages,
      { id: crypto.randomUUID(), role: 'user', content }
    ]});

    await fetch(`${API_BASE}/api/sessions/${sessionId}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, model, mode }),
    });

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
      } else if (data.type === 'message_stop') {
        set((state) => {
          const messages = [...state.messages];
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content = state.streamingContent;
          } else if (state.streamingContent) {
            messages.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: state.streamingContent,
            });
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
      set({ isStreaming: false, currentEventSource: null });
    };
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
}));