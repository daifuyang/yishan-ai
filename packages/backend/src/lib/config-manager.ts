import { watch } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

const CONFIG_DIR = path.join(os.homedir(), '.yishan-ai');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
}

export interface WorkspaceConfig {
  directories: string[];
  allowDelete: boolean;
}

export interface ToolsConfig {
  fs: {
    enabled: boolean;
    workspaceOnly: boolean;
  };
  exec: {
    security: 'allow' | 'ask' | 'deny';
  };
}

export interface LoggingConfig {
  dir: string;
  retentionDays: number;
}

export interface DataConfig {
  dir: string;
}

export interface ServerConfig {
  port: number;
}

export interface ConfigSchema {
  meta: {
    version: string;
    lastTouchedAt: string;
  };
  models: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    models: ModelConfig[];
  };
  workspace: WorkspaceConfig;
  tools: ToolsConfig;
  logging: LoggingConfig;
  data: DataConfig;
  server: ServerConfig;
}

const DEFAULT_CONFIG: ConfigSchema = {
  meta: {
    version: '1.0.0',
    lastTouchedAt: new Date().toISOString(),
  },
  models: {
    provider: 'minimax',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    apiKey: '',
    defaultModel: 'MiniMax-M2.7-highspeed',
    models: [
      { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7高速', contextWindow: 204800 },
      { id: 'MiniMax-M2.7', name: 'MiniMax-M2.7', contextWindow: 204800 },
      { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5高速', contextWindow: 204800 },
      { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5', contextWindow: 204800 },
      { id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1高速', contextWindow: 204800 },
      { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1', contextWindow: 204800 },
      { id: 'MiniMax-M2', name: 'MiniMax-M2', contextWindow: 204800 },
    ],
  },
  workspace: {
    directories: [path.join(os.homedir(), 'yishan-workspace')],
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
  logging: {
    dir: path.join(os.homedir(), '.yishan-ai', 'logs'),
    retentionDays: -1,
  },
  data: {
    dir: path.join(os.homedir(), '.yishan-ai', 'data', 'yishan.db'),
  },
  server: {
    port: 4800,
  },
};

class ConfigManager {
  private config: ConfigSchema;
  private watcher: ReturnType<typeof watch> | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.setupWatcher();
  }

  private loadConfig(): ConfigSchema {
    try {
      if (!fs.existsSync(CONFIG_PATH)) {
        fs.ensureDirSync(CONFIG_DIR);
        const initialConfig = this.migrateFromEnv();
        fs.writeJsonSync(CONFIG_PATH, initialConfig, { spaces: 2 });
        return initialConfig;
      }

      const loaded = fs.readJsonSync(CONFIG_PATH);
      return this.mergeWithDefaults(loaded);
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
      return { ...DEFAULT_CONFIG };
    }
  }

  private mergeWithDefaults(loaded: Partial<ConfigSchema>): ConfigSchema {
    return {
      meta: { ...DEFAULT_CONFIG.meta, ...loaded.meta },
      models: {
        ...DEFAULT_CONFIG.models,
        ...loaded.models,
        models: loaded.models?.models || DEFAULT_CONFIG.models.models,
      },
      workspace: { ...DEFAULT_CONFIG.workspace, ...loaded.workspace },
      tools: {
        fs: { ...DEFAULT_CONFIG.tools.fs, ...loaded.tools?.fs },
        exec: { ...DEFAULT_CONFIG.tools.exec, ...loaded.tools?.exec },
      },
      logging: { ...DEFAULT_CONFIG.logging, ...loaded.logging },
      data: { ...DEFAULT_CONFIG.data, ...loaded.data },
      server: { ...DEFAULT_CONFIG.server, ...loaded.server },
    };
  }

  private migrateFromEnv(): ConfigSchema {
    const config = { ...DEFAULT_CONFIG };

    if (process.env.MINIMAX_API_KEY) {
      config.models.apiKey = process.env.MINIMAX_API_KEY;
    }
    if (process.env.MINIMAX_BASE_URL) {
      config.models.baseUrl = process.env.MINIMAX_BASE_URL;
    }
    if (process.env.DEFAULT_MODEL) {
      config.models.defaultModel = process.env.DEFAULT_MODEL;
    }
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10);
      if (!Number.isNaN(port)) {
        config.server.port = port;
      }
    }

    config.meta.lastTouchedAt = new Date().toISOString();
    return config;
  }

  private resolveEnvVar(value: string): string {
    const match = value.match(/^\$\{([^}]+)\}$/);
    if (match) {
      const envVarName = match[1];
      return process.env[envVarName] || '';
    }
    return value;
  }

  private setupWatcher(): void {
    try {
      this.watcher = watch(CONFIG_DIR, (eventType, filename) => {
        if (filename === 'config.json' && eventType === 'change') {
          this.reload();
        }
      });
    } catch (error) {
      console.warn('Failed to setup config watcher:', error);
    }
  }

  reload(): void {
    this.config = this.loadConfig();
  }

  get<T = unknown>(key: string): T {
    const keys = key.split('.');
    let value: ConfigSchema | unknown = this.config;

    for (const k of keys) {
      if (value === undefined || value === null) return undefined as T;
      if (typeof value !== 'object') return undefined as T;
      value = (value as Record<string, unknown>)[k];
    }

    if (typeof value === 'string') {
      return this.resolveEnvVar(value) as T;
    }

    return value as T;
  }

  getAll(): ConfigSchema {
    return this.config;
  }

  set(updates: Partial<ConfigSchema>): void {
    this.config = this.mergeWithDefaults(updates);
    this.config.meta.lastTouchedAt = new Date().toISOString();
    this.save();
  }

  patch(path: string, value: unknown): void {
    const keys = path.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    this.config.meta.lastTouchedAt = new Date().toISOString();
    this.save();
  }

  private save(): void {
    try {
      fs.ensureDirSync(CONFIG_DIR);
      fs.writeJsonSync(CONFIG_PATH, this.config, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

export const configManager = new ConfigManager();
export default configManager;
