import type {
  ContentBlockDeltaEvent,
  ContentCatchupEvent,
  MessageStopEvent,
  SSEEvent,
  SSLErrorEvent,
  ToolCallEvent,
  ToolErrorEvent,
  ToolResultEvent,
} from './sse-manager';

export type AgentEvent =
  | ContentCatchupEvent
  | ContentBlockDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | MessageStopEvent
  | SSLErrorEvent;

export type SSEHandlers = {
  [K in AgentEvent['type']]?: (event: Extract<AgentEvent, { type: K }>) => void;
};

export interface SSEConnection {
  disconnect: () => void;
}

export function connectToSession(sessionId: string, handlers: SSEHandlers): SSEConnection {
  let eventSource: EventSource | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const maxRetries = 3;
  const retryDelay = 1000;

  function cleanup() {
    disposed = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function createEventSource() {
    if (disposed) return;

    eventSource = new EventSource(`/api/sessions/${sessionId}/chat/subscribe`);

    eventSource.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data) as SSEEvent;
      const handler = (handlers as Record<string, ((event: SSEEvent) => void) | undefined>)[
        data.type
      ];
      if (data.type === 'content_block_delta') {
        if ((data as ContentBlockDeltaEvent).delta?.type === 'text_delta') {
          handler?.(data);
        }
      } else {
        handler?.(data);
      }
    };

    eventSource.onerror = () => {
      if (disposed) return;

      if (reconnectAttempts < maxRetries) {
        reconnectAttempts++;
        const delay = retryDelay * 2 ** (reconnectAttempts - 1);
        reconnectTimeout = setTimeout(() => {
          if (!disposed) {
            createEventSource();
          }
        }, delay);
      } else {
        const errorHandler = handlers.error as ((event: SSLErrorEvent) => void) | undefined;
        errorHandler?.({ type: 'error', message: '连接已断开，请重试' });
        cleanup();
      }
    };
  }

  createEventSource();

  return { disconnect: cleanup };
}
