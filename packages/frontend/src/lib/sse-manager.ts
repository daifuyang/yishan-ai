/**
 * SSE 订阅管理器 - 符合 React 单一订阅来源原则
 *
 * 规范要求：
 * 1. 单一来源 - 同一 sessionId 只允许一个 EventSource
 * 2. 生命周期配对 - 每次 subscribe 都有对应的 cleanup
 * 3. 同步清理 - cleanup 是确定性的
 * 4. 竞态防护 - 订阅前清理旧订阅，不允许重复订阅
 */

export const SSE_EVENTS = {
  STREAM_STARTED: 'stream_started',
  CONTENT_CATCHUP: 'content_catchup',
  CONTENT_BLOCK_DELTA: 'content_block_delta',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  TOOL_ERROR: 'tool_error',
  MESSAGE_STOP: 'message_stop',
  ERROR: 'error',
} as const;

export type SSEEventType = typeof SSE_EVENTS[keyof typeof SSE_EVENTS];

export interface StreamStartedEvent {
  type: 'stream_started';
  data: Record<string, never>;
}

export interface ContentCatchupEvent {
  type: 'content_catchup';
  content: string;
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  delta: {
    type: 'text_delta';
    text: string;
  };
}

export interface ToolCallEvent {
  type: 'tool_call';
  data: {
    tool: string;
    args: Record<string, unknown>;
    description?: string;
  };
}

export interface ToolResultEvent {
  type: 'tool_result';
  data: {
    result: string;
  };
}

export interface ToolErrorEvent {
  type: 'tool_error';
  data: {
    error: string;
  };
}

export interface MessageStopEvent {
  type: 'message_stop';
  data: Record<string, never>;
}

export interface SSLErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent =
  | StreamStartedEvent
  | ContentCatchupEvent
  | ContentBlockDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | MessageStopEvent
  | SSLErrorEvent;

export type SSEHandler<T extends SSEEvent = SSEEvent> = (data: T) => void;

export interface SSEHandlerConfig {
  onStreamStarted?: SSEHandler<StreamStartedEvent>;
  onContentCatchup?: SSEHandler<ContentCatchupEvent>;
  onContentBlockDelta?: SSEHandler<ContentBlockDeltaEvent>;
  onToolCall?: SSEHandler<ToolCallEvent>;
  onToolResult?: SSEHandler<ToolResultEvent>;
  onToolError?: SSEHandler<ToolErrorEvent>;
  onMessageStop?: SSEHandler<MessageStopEvent>;
  onError?: SSEHandler<SSLErrorEvent>;
}

export interface SSEManagerConfig {
  maxRetries?: number;
  retryDelay?: number;
}

export class SSEManager {
  private eventSource: EventSource | null = null;
  private sessionId: string | null = null;
  private handlers: SSEHandlerConfig | null = null;
  private reconnectAttempts = 0;
  private maxRetries = 3;
  private retryDelay = 1000;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  subscribe(sessionId: string, handlers: SSEHandlerConfig, config?: SSEManagerConfig): boolean {
    if (this.sessionId === sessionId && this.eventSource) {
      return false;
    }

    if (config) {
      this.maxRetries = config.maxRetries ?? 3;
      this.retryDelay = config.retryDelay ?? 1000;
    }

    this.cleanup();

    this.sessionId = sessionId;
    this.handlers = handlers;
    this.reconnectAttempts = 0;

    this.createEventSource();
    return true;
  }

  private createEventSource(): void {
    if (!this.sessionId || !this.handlers) return;

    this.eventSource = new EventSource(
      `/api/sessions/${this.sessionId}/chat/subscribe`
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    if (!this.eventSource || !this.handlers) return;

    this.eventSource.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data) as SSEEvent;

      switch (data.type) {
        case SSE_EVENTS.STREAM_STARTED:
          this.handlers?.onStreamStarted?.(data as StreamStartedEvent);
          break;
        case SSE_EVENTS.CONTENT_CATCHUP:
          this.handlers?.onContentCatchup?.(data as ContentCatchupEvent);
          break;
        case SSE_EVENTS.CONTENT_BLOCK_DELTA:
          if (data.delta?.type === 'text_delta') {
            this.handlers?.onContentBlockDelta?.(data as ContentBlockDeltaEvent);
          }
          break;
        case SSE_EVENTS.TOOL_CALL:
          this.handlers?.onToolCall?.(data as ToolCallEvent);
          break;
        case SSE_EVENTS.TOOL_RESULT:
          this.handlers?.onToolResult?.(data as ToolResultEvent);
          break;
        case SSE_EVENTS.TOOL_ERROR:
          this.handlers?.onToolError?.(data as ToolErrorEvent);
          break;
        case SSE_EVENTS.MESSAGE_STOP:
          this.handlers?.onMessageStop?.(data as MessageStopEvent);
          break;
        case SSE_EVENTS.ERROR:
          this.handlers?.onError?.(data as SSLErrorEvent);
          break;
      }
    };

    this.eventSource.onerror = () => {
      if (!this.sessionId || !this.handlers) {
        return;
      }

      if (this.reconnectAttempts < this.maxRetries) {
        this.reconnectAttempts++;
        const delay = this.retryDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.reconnectTimeout = setTimeout(() => {
          if (this.sessionId && this.handlers) {
            this.createEventSource();
          }
        }, delay);
      } else {
        this.handlers?.onError?.({ type: 'error', message: '连接已断开，请重试' });
        this.cleanup();
      }
    };
  }

  cleanup(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.sessionId = null;
    this.handlers = null;
    this.reconnectAttempts = 0;
  }

  isSubscribed(sessionId?: string): boolean {
    if (!this.eventSource) return false;
    return sessionId ? this.sessionId === sessionId : true;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

export const sseManager = new SSEManager();