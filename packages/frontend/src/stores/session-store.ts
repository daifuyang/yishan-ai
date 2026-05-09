import { create } from 'zustand';
import { apiUrl } from '@/lib/api-base';

export interface Session {
  id: string;
  title: string;
  model: string;
  status: 'idle' | 'streaming' | 'completed' | 'failed';
  streamingContent?: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

interface SessionStore {
  sessions: Session[];
  activeId: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (model: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  deleteSession: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateSession: (id: string, data: { title?: string; isPinned?: boolean }) => Promise<void>;
  setActiveId: (id: string | null) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeId: null,

  fetchSessions: async () => {
    try {
      const res = await fetch(apiUrl('/api/sessions'));
      if (!res.ok) throw new Error(`获取会话列表失败: ${res.status}`);
      const sessions = await res.json();
      set({ sessions });
    } catch (error) {
      console.error('fetchSessions error:', error);
      throw error;
    }
  },

  createSession: async (model: string) => {
    try {
      const res = await fetch(apiUrl('/api/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: '创建会话失败' }));
        return { success: false, error: errorData.error || `错误 ${res.status}` };
      }

      const session = await res.json();
      set((state) => ({ sessions: [session, ...state.sessions] }));
      return { success: true, sessionId: session.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      return { success: false, error: errorMessage };
    }
  },

  deleteSession: async (id: string) => {
    const previousSessions = get().sessions;
    const previousActiveId = get().activeId;

    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
    }));

    try {
      const res = await fetch(apiUrl(`/api/sessions/${id}`), { method: 'DELETE' });

      if (!res.ok) {
        set({ sessions: previousSessions, activeId: previousActiveId });
        return { success: false, error: `删除会话失败: ${res.status}` };
      }

      return { success: true };
    } catch (error) {
      set({ sessions: previousSessions, activeId: previousActiveId });
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      return { success: false, error: errorMessage };
    }
  },

  updateSession: async (id, data) => {
    const previousSessions = get().sessions;

    set((state) => ({
      sessions: [...state.sessions]
        .map((s) => (s.id === id ? { ...s, ...data } : s))
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        }),
    }));

    try {
      const res = await fetch(apiUrl(`/api/sessions/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        set({ sessions: previousSessions });
        return;
      }
    } catch (error) {
      set({ sessions: previousSessions });
    }
  },

  setActiveId: (id) => set({ activeId: id }),
}));