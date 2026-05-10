'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseChatScrollOptions {
  messagesLength: number;
  isStreaming: boolean;
  streamingContentLength?: number;
  sessionId?: string | null;
}

export function useChatScroll({
  messagesLength,
  isStreaming,
  streamingContentLength,
  sessionId,
}: UseChatScrollOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledRef = useRef(false);
  const lastMessagesLength = useRef(messagesLength);
  const lastStreamingContentLength = useRef(streamingContentLength ?? 0);
  const pendingScrollRef = useRef(false);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const currentEl = containerRef.current;
        if (!currentEl) return;
        currentEl.scrollTo({ top: currentEl.scrollHeight, behavior });
      });
    });
    return true;
  }, []);

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const element = containerRef.current;
      if (!element) return;
      const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      setIsAtBottom(atBottom);
      setShowScrollButton(!atBottom);
      if (!atBottom && !isStreaming) {
        userScrolledRef.current = true;
      } else if (atBottom) {
        userScrolledRef.current = false;
      }
    };

    scrollHandlerRef.current = handleScroll;
    el.addEventListener('scroll', handleScroll, { passive: true });

    if (pendingScrollRef.current && sessionId) {
      pendingScrollRef.current = false;
      scrollToBottom('instant');
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      scrollHandlerRef.current = null;
    };
  }, [isStreaming, scrollToBottom, sessionId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNewMessage = messagesLength !== lastMessagesLength.current;
    lastMessagesLength.current = messagesLength;

    if (isNewMessage && messagesLength > 0 && !userScrolledRef.current) {
      scrollToBottom('instant');
    }
  }, [messagesLength, scrollToBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isContentGrowing = (streamingContentLength ?? 0) !== lastStreamingContentLength.current;
    lastStreamingContentLength.current = streamingContentLength ?? 0;

    if (isStreaming && isContentGrowing) {
      scrollToBottom('smooth');
    }
  }, [isStreaming, streamingContentLength, scrollToBottom]);

  useEffect(() => {
    if (!isStreaming) {
      userScrolledRef.current = false;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (sessionId) {
      userScrolledRef.current = false;
      lastMessagesLength.current = 0;
      lastStreamingContentLength.current = 0;
      pendingScrollRef.current = true;

      const el = containerRef.current;
      if (el) {
        pendingScrollRef.current = false;
        scrollToBottom('instant');
      }
    }
  }, [sessionId, scrollToBottom]);

  return {
    containerRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
    scrollToTop,
  };
}
