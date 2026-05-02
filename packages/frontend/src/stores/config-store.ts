import { create } from 'zustand';

export interface ConfigState {
  workspace: {
    directories: string[];
    allowDelete: boolean;
  };
  tools: {
    fs: {
      enabled: boolean;
      workspaceOnly: boolean;
    };
    exec: {
      security: 'allow' | 'ask' | 'deny';
    };
  };
  fetchConfig: () => Promise<void>;
  updateConfig: (updates: Partial<ConfigState>) => Promise<void>;
}

const API_BASE = '';

export const useConfigStore = create<ConfigState>((set, get) => ({
  workspace: {
    directories: [],
    allowDelete: false,
  },
  tools: {
    fs: {
      enabled: true,
      workspaceOnly: true,
    },
    exec: {
      security: 'ask',
    },
  },

  fetchConfig: async () => {
    const res = await fetch(`${API_BASE}/api/config`);
    const config = await res.json();
    set({
      workspace: config.workspace || { directories: [], allowDelete: false },
      tools: config.tools || {
        fs: { enabled: true, workspaceOnly: true },
        exec: { security: 'ask' },
      },
    });
  },

  updateConfig: async (updates) => {
    await fetch(`${API_BASE}/api/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await get().fetchConfig();
  },
}));