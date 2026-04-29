import { create } from 'zustand';

export interface Session {
  id: string;
  title: string;
  model: string;
  status: 'idle' | 'streaming' | 'completed' | 'failed';
  streamingContent?: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

interface SessionStore {
  sessions: Session[];
  activeId: string | null;
  fetchSessions: () => Promise<void>;
  createSession: (model: string) => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  setActiveId: (id: string | null) => void;
}

const API_BASE = '';

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeId: null,

  fetchSessions: async () => {
    const res = await fetch(`${API_BASE}/api/sessions`);
    const sessions = await res.json();
    set({ sessions });
  },

  createSession: async (model: string) => {
    const res = await fetch(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    const session = await res.json();
    set((state) => ({ sessions: [session, ...state.sessions] }));
    return session.id;
  },

  deleteSession: async (id: string) => {
    await fetch(`${API_BASE}/api/sessions/${id}`, { method: 'DELETE' });
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
    }));
  },

  setActiveId: (id) => set({ activeId: id }),
}));