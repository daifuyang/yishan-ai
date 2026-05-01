import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const isDev = process.env.NODE_ENV !== 'production';

function mcpLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
  if (!isDev) return;
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[${timestamp}] [MCP] [${level}] ${message}${metaStr}`);
}

export interface MCPConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
}

export interface MCPServer {
  name: string;
  config: MCPConfig;
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

export class McpManager extends EventEmitter {
  private connections = new Map<string, { client: Client; transport: any; tools: MCPTool[] }>();
  private configPath: string;
  private servers: Map<string, MCPServer> = new Map();

  constructor(configDir?: string) {
    super();
    const homeDir = os.homedir();
    const yishanDir = configDir || path.join(homeDir, '.yishan-ai');
    this.configPath = path.join(yishanDir, 'mcp.json');

    if (!fs.existsSync(yishanDir)) {
      fs.mkdirSync(yishanDir, { recursive: true });
    }
  }

  async loadConfig(): Promise<MCPServer[]> {
    if (!fs.existsSync(this.configPath)) {
      return [];
    }

    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      const servers = config.mcpServers || {};

      for (const [name, serverConfig] of Object.entries(servers) as [string, MCPConfig][]) {
        this.servers.set(name, {
          name,
          config: serverConfig,
          enabled: serverConfig.enabled ?? true,
          status: 'disconnected',
          tools: [],
        });
      }

      return Array.from(this.servers.values());
    } catch (err) {
      mcpLog('ERROR', 'Failed to load MCP config', { error: String(err) });
      return [];
    }
  }

  async saveConfig(): Promise<void> {
    const servers: Record<string, MCPConfig & { enabled?: boolean }> = {};
    for (const [name, server] of this.servers) {
      servers[name] = {
        ...server.config,
        enabled: server.enabled,
      };
    }

    const config = { mcpServers: servers };
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  async connectServer(name: string): Promise<MCPTool[]> {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`Server "${name}" not found`);
    }

    if (!server.enabled) {
      throw new Error(`Server "${name}" is disabled`);
    }

    if (this.connections.has(name)) {
      mcpLog('INFO', `Using existing connection for ${name}`);
      return this.connections.get(name)!.tools;
    }

    mcpLog('INFO', `Connecting to MCP server: ${name}`);
    server.status = 'connecting';
    this.emit('serverChanged', this.getServers());
    this.emit('serverStatusChanged', { name, status: 'connecting' });

    try {
      let transport;
      const config = server.config;

      if (config.url) {
        mcpLog('INFO', `Using SSE transport for ${name}`, { url: config.url });
        transport = new SSEClientTransport(new URL(config.url));
      } else if (config.command) {
        mcpLog('INFO', `Using stdio transport for ${name}`, { command: config.command, args: config.args });
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (v !== undefined) env[k] = v;
        }
        if (config.env) {
          for (const [k, v] of Object.entries(config.env)) {
            if (v !== undefined) env[k] = v;
          }
        }
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env,
        });
      } else {
        throw new Error('Invalid MCP server config: must have url or command');
      }

      const client = new Client(
        { name: `yishan-ai-${name}`, version: '1.0.0' },
        { capabilities: {} },
      );

      await client.connect(transport);
      const { tools } = await client.listTools();

      const mcpTools: MCPTool[] = tools.map(t => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema,
      }));

      this.connections.set(name, { client, transport, tools: mcpTools });
      server.status = 'connected';
      server.tools = mcpTools;
      server.error = undefined;

      mcpLog('INFO', `Successfully connected to ${name}`, { toolCount: mcpTools.length });

      this.emit('serverChanged', this.getServers());
      this.emit('serverStatusChanged', { name, status: 'connected' });

      return mcpTools;
    } catch (err: any) {
      mcpLog('ERROR', `Failed to connect to ${name}`, { error: err.message });
      server.status = 'error';
      server.error = err.message;
      this.emit('serverChanged', this.getServers());
      this.emit('serverStatusChanged', { name, status: 'error', error: err.message });
      throw err;
    }
  }

  async disconnectServer(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (!conn) return;

    try {
      await conn.client.close();
    } catch {}

    this.connections.delete(name);

    const server = this.servers.get(name);
    if (server) {
      server.status = 'disconnected';
      server.tools = [];
    }

    this.emit('serverChanged', this.getServers());
    this.emit('serverStatusChanged', { name, status: 'disconnected' });
  }

  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  listTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const conn of this.connections.values()) {
      allTools.push(...conn.tools);
    }
    return allTools;
  }

  getAnthropicTools(): any[] {
    return this.listTools().map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const startTime = Date.now();
    for (const [serverName, conn] of this.connections) {
      const tool = conn.tools.find(t => t.name === toolName);
      if (tool) {
        mcpLog('INFO', `Calling tool ${toolName} on server ${serverName}`, { argsKeys: Object.keys(args) });
        try {
          const result = await conn.client.callTool({
            name: toolName,
            arguments: args,
          });
          const duration = Date.now() - startTime;
          mcpLog('INFO', `Tool ${toolName} completed`, { serverName, duration, resultLength: String(result).length });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          mcpLog('ERROR', `Tool ${toolName} failed`, { serverName, duration, error: err.message });
          throw err;
        }
      }
    }
    mcpLog('WARN', `Tool "${toolName}" not found in any connected server`);
    throw new Error(`Tool "${toolName}" not found`);
  }

  async addServer(name: string, config: MCPConfig): Promise<void> {
    const existing = this.servers.get(name);
    this.servers.set(name, {
      name,
      config,
      enabled: existing?.enabled ?? true,
      status: 'disconnected',
      tools: [],
    });
    await this.saveConfig();
    this.emit('serverChanged', this.getServers());
  }

  async updateServer(name: string, updates: { config?: MCPConfig; enabled?: boolean }): Promise<void> {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`Server "${name}" not found`);
    }

    if (updates.enabled !== undefined) {
      server.enabled = updates.enabled;
      if (!updates.enabled && server.status === 'connected') {
        await this.disconnectServer(name);
      } else if (updates.enabled && server.status === 'disconnected') {
        try {
          await this.connectServer(name);
        } catch {}
      }
    }

    if (updates.config !== undefined) {
      server.config = updates.config;
      if (server.status === 'connected') {
        await this.disconnectServer(name);
        if (server.enabled) {
          try {
            await this.connectServer(name);
          } catch {}
        }
      }
    }

    await this.saveConfig();
    this.emit('serverChanged', this.getServers());
  }

  async removeServer(name: string): Promise<void> {
    await this.disconnectServer(name);
    this.servers.delete(name);
    await this.saveConfig();
    this.emit('serverChanged', this.getServers());
  }

  async reconnectAll(): Promise<void> {
    const disconnected = Array.from(this.servers.entries()).filter(
      ([_, s]) => s.status !== 'connected'
    );

    for (const [name] of disconnected) {
      try {
        await this.connectServer(name);
      } catch {}
    }
  }
}

let mcpManager: McpManager | null = null;

export function getMcpManager(): McpManager {
  if (!mcpManager) {
    mcpManager = new McpManager();
  }
  return mcpManager;
}
