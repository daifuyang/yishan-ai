import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { configManager } from './config-manager.js';

const execAsync = promisify(exec);

const isDev = process.env.NODE_ENV !== 'production';

function mcpLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
  if (!isDev) return;
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[${timestamp}] [MCP] [${level}] ${message}${metaStr}`);
}

interface BuiltInTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: Record<string, any>) => Promise<any>;
}

const builtInTools: Map<string, BuiltInTool> = new Map([
  ['bash', {
    name: 'bash',
    description: `Execute a bash command and return the output.
IMPORTANT: ~ is automatically expanded to home directory. All paths are validated against workspace directories. Paths outside workspace will fail with "Directory does not exist".`,
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to execute' },
        cwd: { type: 'string', description: 'Working directory for the command' },
        description: { type: 'string', description: 'Clear, concise description in 5-10 Chinese words. Example: ls -> "列出当前目录文件"' },
      },
      required: ['command'],
    },
    handler: async (args) => {
      const cwd = args.cwd || configManager.get('workspace.directories')?.[0] || process.cwd();

      try {
        const encodedCommand = Buffer.from(args.command).toString('base64');

        const getSafeDirs = (): string[] => {
          const configPath = os.homedir() + '/.yishan-ai/config.json';
          try {
            if (fs.existsSync(configPath)) {
              const content = fs.readFileSync(configPath, 'utf-8');
              const config = JSON.parse(content);
              if (config.workspace?.directories) {
                return config.workspace.directories.map((d: string) => {
                  if (d.startsWith('~')) return d.replace('~', os.homedir());
                  return d;
                }).filter((d: string) => fs.existsSync(d));
              }
            }
          } catch (e) {}
          return [os.homedir() + '/yishan-workspace'];
        };

        const safeDirs = getSafeDirs();
        const volumeMounts = safeDirs.map(d => `-v "${d}:${d}:rw"`).join(' ');
        const firstDir = safeDirs[0] || '/';

        const dockerCmd = `docker run --rm ` +
          `--user $(id -u):$(id -g) ` +
          `--group-add $(id -g) ` +
          `--cap-drop ALL ` +
          `--security-opt=no-new-privileges ` +
          `--security-opt seccomp=${os.homedir()}/.yishan-ai/isolated/seccomp.json ` +
          `--read-only ` +
          `--memory=512m --memory-swap=512m ` +
          `--pids-limit=64 ` +
          `--ulimit nofile=1024:1024 ` +
          `--env HOME=${firstDir} ` +
          `--env TERM=xterm-256color ` +
          `--tmpfs /tmp:rw,noexec,nosuid,size=64m ` +
          `--tmpfs /var/run:rw,noexec,nosuid,size=8m ` +
          `--entrypoint /bin/bash ` +
          `${volumeMounts} ` +
          `isolated -c 'echo ${encodedCommand} | base64 -d | /bin/bash'`;

        const { stdout, stderr } = await execAsync(dockerCmd, {
          cwd: cwd,
          timeout: 60000,
        });

        let output = stdout.replace(/[\x1b\x9b][\(]?[0-?]*[ -/]*[@-~]/g, '');
        output = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        if (stderr) {
          output += '\nSTDERR: ' + stderr;
        }
        return { content: [{ type: 'text', text: output || '(no output)' }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }] };
      }
    },
  }],
  ['get_current_time', {
    name: 'get_current_time',
    description: 'Get the current system time in multiple formats',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone name (e.g., "Asia/Shanghai", "America/New_York"). Defaults to local timezone.',
        },
        format: {
          type: 'string',
          enum: ['full', 'date', 'time', 'iso'],
          description: 'Output format: "full" (complete datetime), "date" (YYYY-MM-DD), "time" (HH:mm:ss), "iso" (ISO 8601)',
          default: 'full',
        },
      },
    },
    handler: async (args) => {
      const now = new Date();
      let output = '';

      if (args.timezone) {
        try {
          const formatter = new Intl.DateTimeFormat('zh-CN', {
            timeZone: args.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          output = formatter.format(now);
          if (args.format === 'iso') {
            output = now.toISOString();
          }
        } catch {
          return { content: [{ type: 'text', text: `Invalid timezone: ${args.timezone}` }] };
        }
      } else {
        const localeStr = now.toLocaleString('zh-CN');
        const isoStr = now.toISOString();
        const utcStr = now.toUTCString();

        switch (args.format) {
          case 'date':
            output = now.toLocaleDateString('zh-CN');
            break;
          case 'time':
            output = now.toLocaleTimeString('zh-CN');
            break;
          case 'iso':
            output = isoStr;
            break;
          default:
            output = `本地时间: ${localeStr}\nUTC 时间: ${utcStr}\nISO 时间: ${isoStr}`;
        }
      }

      return { content: [{ type: 'text', text: output }] };
    },
  }],
]);

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
    for (const tool of builtInTools.values()) {
      allTools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
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

    if (builtInTools.has(toolName)) {
      const tool = builtInTools.get(toolName)!;
      mcpLog('INFO', `Calling built-in tool: ${toolName}`, { argsKeys: Object.keys(args) });
      try {
        const result = await tool.handler(args);
        const duration = Date.now() - startTime;
        mcpLog('INFO', `Built-in tool ${toolName} completed`, { duration });
        return result;
      } catch (err: any) {
        const duration = Date.now() - startTime;
        mcpLog('ERROR', `Built-in tool ${toolName} failed`, { duration, error: err.message });
        throw err;
      }
    }

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
