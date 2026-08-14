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
  sandbox: {
    defaultMode: 'read-only' | 'workspace-write' | 'full-access';
  };
  approval: {
    defaultPolicy: 'auto-allow' | 'ask' | 'deny';
  };
  tools: {
    fs: {
      enabled: boolean;
      workspaceOnly: boolean;
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
  sandbox: {
    defaultMode: 'workspace-write',
  },
  approval: {
    defaultPolicy: 'auto-allow',
  },
  tools: {
    fs: {
      enabled: true,
      workspaceOnly: true,
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
      sandbox: config.sandbox || { defaultMode: 'workspace-write' },
      approval: config.approval || { defaultPolicy: 'auto-allow' },
      tools: config.tools || {
        fs: { enabled: true, workspaceOnly: true },
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
