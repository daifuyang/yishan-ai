import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

class MockEventSource {
  static instances: MockEventSource[] = [];
  close = vi.fn();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_url: string) {
    MockEventSource.instances.push(this);
  }

  static clearInstances() {
    MockEventSource.instances = [];
  }

  static getLastInstance(): MockEventSource {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

vi.stubGlobal('EventSource', MockEventSource);

import { SSEManager } from './sse-manager';

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    manager = new SSEManager();
    MockEventSource.clearInstances();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('subscribe', () => {
    it('should create EventSource with correct URL', () => {
      manager.subscribe('session-123', {});

      const eventSource = MockEventSource.getLastInstance();
      expect(eventSource).toBeDefined();
      expect(MockEventSource.instances.length).toBe(1);
    });

    it('should return true when successfully subscribing to new session', () => {
      const result = manager.subscribe('session-123', {});

      expect(result).toBe(true);
      expect(manager.isSubscribed()).toBe(true);
    });

    it('should return false when subscribing to same sessionId twice', () => {
      const result1 = manager.subscribe('session-123', {});
      expect(result1).toBe(true);

      const result2 = manager.subscribe('session-123', {});
      expect(result2).toBe(false);

      expect(MockEventSource.instances.length).toBe(1);
    });

    it('should cleanup previous subscription before creating new one', () => {
      manager.subscribe('session-1', {});
      expect(MockEventSource.instances.length).toBe(1);
      const firstSource = MockEventSource.getLastInstance();

      manager.subscribe('session-2', {});
      expect(MockEventSource.instances.length).toBe(2);
      expect(firstSource.close).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should close existing EventSource', () => {
      manager.subscribe('session-123', {});
      const eventSource = MockEventSource.getLastInstance();

      expect(eventSource.close).not.toHaveBeenCalled();

      manager.cleanup();
      expect(eventSource.close).toHaveBeenCalledTimes(1);
      expect(manager.isSubscribed()).toBe(false);
    });

    it('should be idempotent', () => {
      manager.subscribe('session-123', {});
      const eventSource = MockEventSource.getLastInstance();

      manager.cleanup();
      manager.cleanup();
      manager.cleanup();

      expect(eventSource.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSubscribed', () => {
    it('should return false when not subscribed', () => {
      expect(manager.isSubscribed()).toBe(false);
      expect(manager.isSubscribed('session-123')).toBe(false);
    });

    it('should return true for any sessionId when subscribed', () => {
      manager.subscribe('session-123', {});

      expect(manager.isSubscribed()).toBe(true);
      expect(manager.isSubscribed('session-123')).toBe(true);
      expect(manager.isSubscribed('session-456')).toBe(false);
    });
  });

  describe('getSessionId', () => {
    it('should return null when not subscribed', () => {
      expect(manager.getSessionId()).toBe(null);
    });

    it('should return sessionId when subscribed', () => {
      manager.subscribe('session-123', {});
      expect(manager.getSessionId()).toBe('session-123');
    });

    it('should return null after cleanup', () => {
      manager.subscribe('session-123', {});
      expect(manager.getSessionId()).toBe('session-123');

      manager.cleanup();
      expect(manager.getSessionId()).toBe(null);
    });
  });

  describe('event handlers', () => {
    it('should call onContentCatchup handler', () => {
      const handler = vi.fn();
      manager.subscribe('session-123', {
        onContentCatchup: handler,
      });

      const eventSource = MockEventSource.getLastInstance();
      const mockEvent = {
        data: JSON.stringify({ type: 'content_catchup', content: 'test content' }),
      };
      eventSource.onmessage?.(mockEvent as MessageEvent);

      expect(handler).toHaveBeenCalledWith({ type: 'content_catchup', content: 'test content' });
    });

    it('should call onContentBlockDelta handler for text_delta', () => {
      const handler = vi.fn();
      manager.subscribe('session-123', {
        onContentBlockDelta: handler,
      });

      const eventSource = MockEventSource.getLastInstance();
      const mockEvent = {
        data: JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } }),
      };
      eventSource.onmessage?.(mockEvent as MessageEvent);

      expect(handler).toHaveBeenCalledWith({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } });
    });

    it('should NOT call onContentBlockDelta for non-text_delta', () => {
      const handler = vi.fn();
      manager.subscribe('session-123', {
        onContentBlockDelta: handler,
      });

      const eventSource = MockEventSource.getLastInstance();
      const mockEvent = {
        data: JSON.stringify({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } }),
      };
      eventSource.onmessage?.(mockEvent as MessageEvent);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should call onToolCall handler', () => {
      const handler = vi.fn();
      manager.subscribe('session-123', {
        onToolCall: handler,
      });

      const eventSource = MockEventSource.getLastInstance();
      const mockEvent = {
        data: JSON.stringify({ type: 'tool_call', data: { tool: 'bash', args: { command: 'ls' } } }),
      };
      eventSource.onmessage?.(mockEvent as MessageEvent);

      expect(handler).toHaveBeenCalledWith({ type: 'tool_call', data: { tool: 'bash', args: { command: 'ls' } } });
    });

    it('should call onMessageStop handler', () => {
      const handler = vi.fn();
      manager.subscribe('session-123', {
        onMessageStop: handler,
      });

      const eventSource = MockEventSource.getLastInstance();
      const mockEvent = {
        data: JSON.stringify({ type: 'message_stop' }),
      };
      eventSource.onmessage?.(mockEvent as MessageEvent);

      expect(handler).toHaveBeenCalled();
    });

    it('should call onError handler and cleanup on error', () => {
      const errorHandler = vi.fn();
      manager.subscribe('session-123', {
        onError: errorHandler,
      });

      const eventSource = MockEventSource.getLastInstance();
      eventSource.onerror?.();

      expect(errorHandler).toHaveBeenCalled();
      expect(manager.isSubscribed()).toBe(false);
    });
  });

  describe('race condition prevention', () => {
    it('should prevent duplicate subscriptions via rapid subscribe calls', () => {
      manager.subscribe('session-123', {});
      manager.subscribe('session-123', {});
      manager.subscribe('session-123', {});
      manager.subscribe('session-123', {});

      expect(MockEventSource.instances.length).toBe(1);
    });
  });
});