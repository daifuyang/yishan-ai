import { fork, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'events';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendMessage, getAnthropicMessages } from '../stores/message-store.js';
import { updateSessionStatus, autoTitle, getSession } from '../stores/session-store.js';
import type { StartParams } from './stream-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, '../workers/chat-stream.worker.js');

class StreamHub extends EventEmitter {
  private worker: ChildProcess | null = null;
  private currentSessionId: string | null = null;

  start(params: StartParams): string {
    const { sessionId, userMessage, options, tools } = params;

    const msg = appendMessage(sessionId, 'user', userMessage);
    autoTitle(sessionId, typeof userMessage === 'string' ? userMessage : JSON.stringify(userMessage));
    updateSessionStatus(sessionId, 'streaming', '');

    const allMessages = getAnthropicMessages(sessionId);
    this.startWorker(sessionId, allMessages, options as Record<string, unknown>, tools);

    return msg.id;
  }

  pipeToSSE(reply: any, mcpManager: any): { cleanup: () => void } {
    const session = this.currentSessionId ? getSession(this.currentSessionId) : null;

    if (session?.status === 'idle') {
      reply.raw.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      reply.raw.end();
      return { cleanup: () => {} };
    }

    if (session?.status === 'failed') {
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Session failed' })}\n\n`);
      reply.raw.end();
      return { cleanup: () => {} };
    }

    if (session?.streamingContent) {
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
      try {
        const result = await mcpManager.callTool(data.tool, data.args);
        this.sendToWorker('tool_result', { result });
      } catch (err: any) {
        this.sendToWorker('tool_error', { error: err.message });
      }
    };

    const onDone = () => {
      sendSSE({ type: 'message_stop' });
      reply.raw.end();
      this.off('delta', onDelta);
      this.off('tool_call', onToolCall);
      this.off('done', onDone);
      this.off('error', onError);
    };

    const onError = (data: any) => {
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
      this.off('delta', onDelta);
      this.off('tool_call', onToolCall);
      this.off('done', onDone);
      this.off('error', onError);
    };

    return { cleanup };
  }

  private startWorker(sessionId: string, messages: unknown[], options: Record<string, unknown>, tools: unknown[]): void {
    this.worker = fork(WORKER_PATH, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env },
    });

    this.currentSessionId = sessionId;

    this.worker.on('message', (msg: { type: string; data?: unknown }) => {
      console.error('[STREAM_HUB] message from worker:', msg.type, msg.data);
      if (msg.type === 'tool_call') {
        this.emit('tool_call', msg.data);
      } else if (msg.type === 'delta' || msg.type === 'done' || msg.type === 'error' || msg.type === 'exit') {
        this.emit(msg.type, msg.data);
      }
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.emit('error', { message: `Worker exited with code ${code}` });
      }
      this.worker = null;
      this.currentSessionId = null;
    });

    this.worker.on('error', (err) => {
      this.emit('error', { message: String(err) });
    });

    this.worker.send({ type: 'init', data: { sessionId, messages, options, tools } });
    console.error('[STREAM_HUB] Worker init message sent');
  }

  sendToWorker(type: string, data: unknown): void {
    if (this.worker) {
      this.worker.send({ type, data });
    }
  }

  stop(): boolean {
    if (!this.worker) return false;
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
