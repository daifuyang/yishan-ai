import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_DIR = process.env.LOG_DIR || path.join(os.homedir(), '.yishan-ai', 'logs');
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '-1', 10);
const LOG_MAX_SIZE = parseInt(process.env.LOG_MAX_SIZE || '10485760', 10);

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class RotatingFileWriter {
  private filePath: string;
  private currentSize: number = 0;
  private fd: number | null = null;
  private maxSize: number;

  constructor(filePath: string, maxSize: number) {
    this.filePath = filePath;
    this.maxSize = maxSize;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  write(str: string): void {
    this.currentSize += Buffer.byteLength(str, 'utf8');
    if (this.currentSize >= this.maxSize) {
      this.rotate();
    }
    if (this.fd === null) {
      this.fd = fs.openSync(this.filePath, 'a');
    }
    fs.writeSync(this.fd, str);
  }

  private rotate(): void {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }

    let counter = 1;
    let rotatedPath: string;
    do {
      rotatedPath = `${this.filePath}-${counter}`;
      counter++;
    } while (fs.existsSync(rotatedPath));

    fs.renameSync(this.filePath, rotatedPath);
    this.currentSize = 0;
  }

  end(): void {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}

class SessionLogger {
  private sessionId: string;
  private correlationId: string;
  private writer: RotatingFileWriter;
  private logger: pino.Logger;

  constructor(sessionId: string, correlationId: string) {
    this.sessionId = sessionId;
    this.correlationId = correlationId;

    const date = new Date().toISOString().split('T')[0];
    const shortSessionId = sessionId.slice(0, 8);
    const fileName = `session-${shortSessionId}-${date}.log`;
    const filePath = path.join(LOG_DIR, fileName);

    this.writer = new RotatingFileWriter(filePath, LOG_MAX_SIZE);

    const fileDestination = {
      write: (str: string) => this.writer.write(str),
    };

    if (isDev) {
      this.logger = pino(
        {
          level: 'debug',
          base: {
            pid: process.pid,
            hostname: os.hostname(),
            sessionId: this.sessionId,
            correlationId: this.correlationId.slice(0, 8),
          },
          timestamp: () => `,"time":"${new Date().toISOString()}"`,
        },
        pino.multistream([
          {
            stream: pinoPretty({
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
              singleLine: false,
            }),
            level: 'debug',
          },
          { stream: fileDestination, level: 'debug' },
        ])
      );
    } else {
      this.logger = pino(
        {
          level: 'info',
          base: {
            pid: process.pid,
            hostname: os.hostname(),
            sessionId: this.sessionId,
            correlationId: this.correlationId,
          },
          timestamp: () => `,"time":"${new Date().toISOString()}"`,
        },
        fileDestination
      );
    }
  }

  private sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> {
    if (!meta) return {};
    const sensitiveFields = [
      'apiKey',
      'token',
      'password',
      'authorization',
      'secret',
      'MINIMAX_API_KEY',
    ];
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        sanitized[key] = '***';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = `${value.slice(0, 500)}...`;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMeta(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  debug(component: string, message: string, meta?: Record<string, unknown>): void {
    const sanitized = this.sanitizeMeta(meta);
    this.logger.debug({ component, message, ...sanitized });
  }

  info(component: string, message: string, meta?: Record<string, unknown>): void {
    const sanitized = this.sanitizeMeta(meta);
    this.logger.info({ component, message, ...sanitized });
  }

  warn(component: string, message: string, meta?: Record<string, unknown>): void {
    const sanitized = this.sanitizeMeta(meta);
    this.logger.warn({ component, message, ...sanitized });
  }

  error(component: string, message: string, error?: Error, meta?: Record<string, unknown>): void {
    const sanitized = this.sanitizeMeta({
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
      ...meta,
    });
    this.logger.error({ component, message, ...sanitized });
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getCorrelationId(): string {
    return this.correlationId;
  }

  close(): void {
    this.writer.end();
  }
}

const loggers = new Map<string, SessionLogger>();

function generateCorrelationId(): string {
  return Math.random().toString(36).substring(2, 18);
}

export function createLogger(sessionId: string, correlationId?: string): SessionLogger {
  const id = correlationId || generateCorrelationId();
  const existing = loggers.get(sessionId);
  if (existing) {
    return existing;
  }
  const logger = new SessionLogger(sessionId, id);
  loggers.set(sessionId, logger);
  return logger;
}

export function getLogger(sessionId: string): SessionLogger | undefined {
  return loggers.get(sessionId);
}

export function closeLogger(sessionId: string): void {
  const logger = loggers.get(sessionId);
  if (logger) {
    logger.close();
    loggers.delete(sessionId);
  }
}

export function cleanupOldLogs(): void {
  if (LOG_RETENTION_DAYS <= 0) return;

  if (!fs.existsSync(LOG_DIR)) return;

  const now = Date.now();
  const cutoff = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(LOG_DIR);
    for (const file of files) {
      if (!file.startsWith('session-') || !file.endsWith('.log')) continue;
      const filePath = path.join(LOG_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > cutoff) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  } catch {}
}

setInterval(cleanupOldLogs, 60 * 60 * 1000);

export { LOG_DIR, LOG_MAX_SIZE, LOG_RETENTION_DAYS };
