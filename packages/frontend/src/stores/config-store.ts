import { create } from 'zustand';
import { apiUrl } from '@/lib/api-base';

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
}

export interface ConfigState {
  models: {
    provider: string;
    defaultModel: string;
    models: ModelInfo[];
  };
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

export const useConfigStore = create<ConfigState>((set, get) => ({
  models: {
    provider: 'minimax',
    defaultModel: 'MiniMax-M2.7-highspeed',
    models: [],
  },
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
    const res = await fetch(apiUrl('/api/config'));
    const config = await res.json();
    set({
      models: config.models || {
        provider: 'minimax',
        defaultModel: 'MiniMax-M2.7-highspeed',
        models: [],
      },
      workspace: config.workspace || { directories: [], allowDelete: false },
      tools: config.tools || {
        fs: { enabled: true, workspaceOnly: true },
        exec: { security: 'ask' },
      },
    });
  },

  updateConfig: async (updates) => {
    await fetch(apiUrl('/api/config'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await get().fetchConfig();
  },
}));
