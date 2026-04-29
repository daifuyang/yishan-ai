import { fork, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, '../workers/chat-stream.worker.js');

class StreamHub extends EventEmitter {
  private worker: ChildProcess | null = null;
  private currentSessionId: string | null = null;

  startWorker(sessionId: string, messages: unknown[], options: Record<string, unknown>): void {
    this.worker = fork(WORKER_PATH, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env },
    });

    this.currentSessionId = sessionId;

    this.worker.on('message', (msg: { type: string; data?: unknown }) => {
      this.emit(msg.type, msg.data);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.emit('error', { message: `Worker exited with code ${code}` });
      }
      this.emit('exit', { code });
      this.worker = null;
      this.currentSessionId = null;
    });

    this.worker.on('error', (err) => {
      this.emit('error', { message: String(err) });
    });

    this.worker.send({ type: 'init', data: { sessionId, messages, options } });
  }

  stopWorker(): boolean {
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