import { create } from 'zustand';

export interface MCPServer {
  name: string;
  config: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
  };
  enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  tools: MCPTool[];
  error?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPSStore {
  servers: MCPServer[];
  tools: MCPTool[];
  fetchServers: () => Promise<void>;
  addServer: (name: string, config: MCPServer['config']) => Promise<void>;
  updateServer: (name: string, updates: { config?: MCPServer['config']; enabled?: boolean }) => Promise<void>;
  removeServer: (name: string) => Promise<void>;
  connectServer: (name: string) => Promise<void>;
  disconnectServer: (name: string) => Promise<void>;
  fetchTools: () => Promise<void>;
}

const API_BASE = '';

export const useMCPSStore = create<MCPSStore>((set, get) => ({
  servers: [],
  tools: [],

  fetchServers: async () => {
    const res = await fetch(`${API_BASE}/api/mcp/servers`);
    const servers = await res.json();
    set({ servers });
  },

  addServer: async (name: string, config: MCPServer['config']) => {
    await fetch(`${API_BASE}/api/mcp/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config }),
    });
    await get().fetchServers();
  },

  updateServer: async (name: string, updates: { config?: MCPServer['config']; enabled?: boolean }) => {
    await fetch(`${API_BASE}/api/mcp/servers/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await get().fetchServers();
    await get().fetchTools();
  },

  removeServer: async (name: string) => {
    await fetch(`${API_BASE}/api/mcp/servers/${name}`, { method: 'DELETE' });
    await get().fetchServers();
  },

  connectServer: async (name: string) => {
    await fetch(`${API_BASE}/api/mcp/servers/${name}/connect`, { method: 'POST' });
    await get().fetchServers();
    await get().fetchTools();
  },

  disconnectServer: async (name: string) => {
    await fetch(`${API_BASE}/api/mcp/servers/${name}/disconnect`, { method: 'POST' });
    await get().fetchServers();
  },

  fetchTools: async () => {
    const res = await fetch(`${API_BASE}/api/mcp/tools`);
    const tools = await res.json();
    set({ tools });
  },
}));
