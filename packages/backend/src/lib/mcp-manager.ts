import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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
  inputSchema: unknown;
}

interface RawMCPTool {
  name: string;
  description?: string;
  input_schema?: unknown;
  inputSchema?: unknown;
}

export class McpManager extends EventEmitter {
  private connections = new Map<
    string,
    { client: Client; transport: SSEClientTransport | StdioClientTransport; tools: MCPTool[] }
  >();
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

    if (this.connections.has(name)) {
      mcpLog('INFO', `Using existing connection for ${name}`);
      const conn = this.connections.get(name);
      if (conn) {
        server.tools = conn.tools;
        return conn.tools;
      }
    }

    mcpLog('INFO', `Connecting to MCP server: ${name}`);

    try {
      let transport: SSEClientTransport | StdioClientTransport;

      if (server.config.url) {
        mcpLog('INFO', `Using SSE transport for ${name}`, { url: server.config.url });
        transport = new SSEClientTransport(new URL(server.config.url));
      } else if (server.config.command) {
        mcpLog('INFO', `Using stdio transport for ${name}`, {
          command: server.config.command,
          args: server.config.args,
        });
        transport = new StdioClientTransport({
          command: server.config.command,
          args: server.config.args || [],
          env: server.config.env,
        });
      } else {
        throw new Error('Invalid MCP server config: must have url or command');
      }

      const client = new Client({
        name: 'yishan-mcp-client',
        version: '1.0.0',
      });

      await client.connect(transport);

      const toolsResult = await client.listTools();
      const tools = (toolsResult as { tools?: RawMCPTool[] }).tools || [];

      const mcpTools: MCPTool[] = (tools as RawMCPTool[]).map((t) => {
        const inputSchema = t.input_schema || t.inputSchema || { type: 'object', properties: {} };
        mcpLog('INFO', `Mapping tool ${t.name}`, {
          hasInputSchema: !!(t.input_schema || t.inputSchema),
          inputSchemaType: (inputSchema as { type?: string }).type,
        });
        return {
          name: t.name,
          description: t.description || '',
          inputSchema,
        };
      });

      this.connections.set(name, { client, transport, tools: mcpTools });
      server.tools = mcpTools;
      server.status = 'connected';

      mcpLog('INFO', `Successfully connected to ${name}`, { toolCount: mcpTools.length });
      this.emit('serverChanged', this.getServers());

      return mcpTools;
    } catch (err: unknown) {
      const error = err as Error;
      server.status = 'error';
      server.error = error.message;
      mcpLog('ERROR', `Failed to connect to ${name}`, { error: error.message });
      this.emit('serverChanged', this.getServers());
      throw err;
    }
  }

  async disconnectServer(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (!conn) {
      return;
    }

    mcpLog('INFO', `Disconnecting from ${name}`);

    try {
      await conn.client.close();
    } catch (err) {
      mcpLog('WARN', `Error closing connection to ${name}`, { error: String(err) });
    }

    this.connections.delete(name);

    const server = this.servers.get(name);
    if (server) {
      server.status = 'disconnected';
      server.tools = [];
    }

    this.emit('serverChanged', this.getServers());
  }

  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  listTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const conn of this.connections.values()) {
      for (const t of conn.tools) {
        if (t.name && t.inputSchema) {
          allTools.push(t);
        } else {
          mcpLog('WARN', `Skipping invalid tool`, {
            name: t.name,
            hasInputSchema: !!t.inputSchema,
          });
        }
      }
    }
    return allTools;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const startTime = Date.now();

    for (const [serverName, conn] of this.connections) {
      const tool = conn.tools.find((t) => t.name === toolName);
      if (tool) {
        mcpLog('INFO', `Calling tool ${toolName} on server ${serverName}`, {
          argsKeys: Object.keys(args),
        });
        try {
          const result = await conn.client.callTool({
            name: toolName,
            arguments: args,
          });
          const duration = Date.now() - startTime;
          mcpLog('INFO', `Tool ${toolName} completed`, {
            serverName,
            duration,
            resultLength: String(result).length,
          });
          return result;
        } catch (err: unknown) {
          const error = err as Error;
          const duration = Date.now() - startTime;
          mcpLog('ERROR', `Tool ${toolName} failed`, {
            serverName,
            duration,
            error: error.message,
          });
          throw err;
        }
      }
    }

    mcpLog('WARN', `Tool "${toolName}" not found in any connected MCP server`);
    throw new Error(`Tool "${toolName}" not found in any connected MCP server`);
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

  async updateServer(
    name: string,
    updates: { config?: MCPConfig; enabled?: boolean }
  ): Promise<void> {
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

    await Promise.allSettled(
      disconnected
        .filter(([_, s]) => s.enabled)
        .map(([name]) => this.connectServer(name).catch(() => {}))
    );
  }

  getTools(): MCPTool[] {
    return this.listTools();
  }
}

let mcpManager: McpManager | null = null;

export function getMcpManager(): McpManager {
  if (!mcpManager) {
    mcpManager = new McpManager();
  }
  return mcpManager;
}
