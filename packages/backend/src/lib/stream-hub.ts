import { fork, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'events';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendMessage, getAnthropicMessages } from '../stores/message-store.js';
import { updateSessionStatus, autoTitle, getSession } from '../stores/session-store.js';
import { getLogger } from './logger.js';
import type { StartParams } from './stream-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, '../workers/chat-stream.worker.js');

class StreamHub extends EventEmitter {
  private worker: ChildProcess | null = null;
  private currentSessionId: string | null = null;
  private currentCorrelationId: string | null = null;

  start(params: StartParams): string {
    const { sessionId, userMessage, options, tools } = params;
    const correlationId = options.correlationId as string || 'unknown';

    const log = getLogger(sessionId);
    log?.info('STREAM_HUB', 'Starting stream', {
      sessionId,
      correlationId,
      messageLength: typeof userMessage === 'string' ? userMessage.length : JSON.stringify(userMessage).length,
      toolCount: tools?.length || 0,
    });

    const msg = appendMessage(sessionId, 'user', userMessage);
    autoTitle(sessionId, typeof userMessage === 'string' ? userMessage : JSON.stringify(userMessage));
    updateSessionStatus(sessionId, 'streaming', '');

    const allMessages = getAnthropicMessages(sessionId);
    log?.debug('STREAM_HUB', 'Retrieved messages for context', { messageCount: allMessages.length });

    this.currentCorrelationId = correlationId;
    this.startWorker(sessionId, allMessages, options as Record<string, unknown>, tools);

    log?.debug('STREAM_HUB', 'Worker started', { sessionId });
    return msg.id;
  }

  pipeToSSE(reply: any, mcpManager: any): { cleanup: () => void } {
    const sessionId = this.currentSessionId;
    const log = sessionId ? getLogger(sessionId) : null;

    if (sessionId) {
      log?.debug('STREAM_HUB', 'Setting up SSE pipeline', { sessionId });
    }

    const session = sessionId ? getSession(sessionId) : null;

    if (session?.status === 'idle') {
      log?.debug('STREAM_HUB', 'Session already idle, sending message_stop', { sessionId });
      reply.raw.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      reply.raw.end();
      return { cleanup: () => {} };
    }

    if (session?.status === 'failed') {
      log?.warn('STREAM_HUB', 'Session failed, sending error', { sessionId });
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Session failed' })}\n\n`);
      reply.raw.end();
      return { cleanup: () => {} };
    }

    if (session?.streamingContent) {
      log?.debug('STREAM_HUB', 'Sending content catchup', { sessionId, contentLength: session.streamingContent.length });
      reply.raw.write(`data: ${JSON.stringify({ type: 'content_catchup', content: session.streamingContent })}\n\n`);
    }

    const sendSSE = (event: any) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const onDelta = (data: any) => {
      if (data.delta?.type === 'text_delta') {
        sendSSE({ type: 'content_block_delta', delta: data.delta });
      }
    };

    const onToolCall = async (data: { tool: string; args: Record<string, unknown> }) => {
      log?.info('STREAM_HUB', 'Tool call received from worker', {
        tool: data.tool,
        argsKeys: Object.keys(data.args || {}),
      });

      try {
        const startTime = Date.now();
        const result = await mcpManager.callTool(data.tool, data.args);
        const duration = Date.now() - startTime;

        log?.info('STREAM_HUB', 'Tool result received', {
          tool: data.tool,
          duration,
          resultLength: typeof result === 'string' ? result.length : JSON.stringify(result).length,
        });

        this.sendToWorker('tool_result', { result });
      } catch (err: any) {
        log?.error('STREAM_HUB', 'Tool call failed', err, {
          tool: data.tool,
          error: err.message,
        });
        this.sendToWorker('tool_error', { error: err.message });
      }
    };

    const onDone = () => {
      log?.info('STREAM_HUB', 'Stream completed', { sessionId });
      sendSSE({ type: 'message_stop' });
      reply.raw.end();
      this.off('delta', onDelta);
      this.off('tool_call', onToolCall);
      this.off('done', onDone);
      this.off('error', onError);
    };

    const onError = (data: any) => {
      log?.error('STREAM_HUB', 'Stream error received', undefined, { sessionId, message: data.message });
      sendSSE({ type: 'error', message: data.message });
      reply.raw.end();
      this.off('delta', onDelta);
      this.off('tool_call', onToolCall);
      this.off('done', onDone);
      this.off('error', onError);
    };

    this.on('delta', onDelta);
    this.on('tool_call', onToolCall);
    this.on('done', onDone);
    this.on('error', onError);

    const cleanup = () => {
      log?.debug('STREAM_HUB', 'SSE cleanup called', { sessionId });
      this.off('delta', onDelta);
      this.off('tool_call', onToolCall);
      this.off('done', onDone);
      this.off('error', onError);
    };

    return { cleanup };
  }

  private startWorker(sessionId: string, messages: unknown[], options: Record<string, unknown>, tools: unknown[]): void {
    const correlationId = options.correlationId as string || 'unknown';
    const log = getLogger(sessionId);

    this.worker = fork(WORKER_PATH, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env },
    });

    this.currentSessionId = sessionId;

    this.worker.on('message', (msg: { type: string; data?: unknown }) => {
      if (msg.type === 'log') {
        const { level, message, meta } = msg.data as { level: string; message: string; meta: Record<string, unknown> };
        if (level === 'DEBUG') {
          log?.debug('WORKER', message, meta);
        } else if (level === 'INFO') {
          log?.info('WORKER', message, meta);
        } else if (level === 'WARN') {
          log?.warn('WORKER', message, meta);
        } else if (level === 'ERROR') {
          log?.error('WORKER', message, undefined, meta);
        }
      } else if (msg.type === 'tool_call') {
        log?.debug('STREAM_HUB', 'IPC: tool_call received from worker', { correlationId });
        this.emit('tool_call', msg.data);
      } else if (msg.type === 'delta') {
        this.emit('delta', msg.data);
      } else if (msg.type === 'done') {
        log?.info('STREAM_HUB', 'IPC: done received from worker', { correlationId });
        this.emit('done', msg.data);
      } else if (msg.type === 'error') {
        log?.error('STREAM_HUB', 'IPC: error received from worker', undefined, { correlationId, message: (msg.data as any)?.message });
        this.emit('error', msg.data);
      } else if (msg.type === 'exit') {
        log?.debug('STREAM_HUB', 'IPC: exit received from worker', { correlationId, code: (msg.data as any)?.code });
        this.emit('exit', msg.data);
      }
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        log?.error('STREAM_HUB', 'Worker exited with non-zero code', undefined, { code });
        this.emit('error', { message: `Worker exited with code ${code}` });
      } else {
        log?.debug('STREAM_HUB', 'Worker exited normally', { code });
      }
      this.worker = null;
      this.currentSessionId = null;
      this.currentCorrelationId = null;
    });

    this.worker.on('error', (err) => {
      log?.error('STREAM_HUB', 'Worker error event', err);
      this.emit('error', { message: String(err) });
    });

    this.worker.send({ type: 'init', data: { sessionId, messages, options, tools } });
    log?.debug('STREAM_HUB', 'Worker init message sent', { correlationId });
  }

  sendToWorker(type: string, data: unknown): void {
    const log = this.currentSessionId ? getLogger(this.currentSessionId) : null;
    log?.debug('STREAM_HUB', 'Sending to worker', { type, correlationId: this.currentCorrelationId });

    if (this.worker) {
      this.worker.send({ type, data });
    }
  }

  stop(): boolean {
    const log = this.currentSessionId ? getLogger(this.currentSessionId) : null;
    log?.info('STREAM_HUB', 'Stop requested', { correlationId: this.currentCorrelationId });

    if (!this.worker) {
      log?.warn('STREAM_HUB', 'Stop requested but no worker running');
      return false;
    }
    this.worker.send({ type: 'stop' });
    return true;
  }

  isRunning(): boolean {
    return this.worker !== null;
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
}

export const streamHub = new StreamHub();
