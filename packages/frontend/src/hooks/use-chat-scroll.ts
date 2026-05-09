"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseChatScrollOptions {
  messagesLength: number;
  isStreaming: boolean;
  streamingContentLength?: number;
  sessionId?: string | null;
}

export function useChatScroll({ messagesLength, isStreaming, streamingContentLength, sessionId }: UseChatScrollOptions) {
  const containerRefInternal = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledRef = useRef(false);
  const lastMessagesLength = useRef(messagesLength);
  const lastStreamingContentLength = useRef(streamingContentLength ?? 0);
  const pendingScrollRef = useRef(false);

  const getContainer = useCallback(() => containerRefInternal.current, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = getContainer();
    if (!el) return false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const currentEl = getContainer();
        if (!currentEl) return;
        currentEl.scrollTo({ top: currentEl.scrollHeight, behavior });
      });
    });
    return true;
  }, [getContainer]);

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = getContainer();
    if (!el) return;
    el.scrollTo({ top: 0, behavior });
  }, [getContainer]);

  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    containerRefInternal.current = node;
    if (node) {
      const handleScroll = () => {
        const el = containerRefInternal.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setIsAtBottom(atBottom);
        setShowScrollButton(!atBottom);
        if (!atBottom && !isStreaming) {
          userScrolledRef.current = true;
        } else if (atBottom) {
          userScrolledRef.current = false;
        }
      };
      node.addEventListener("scroll", handleScroll, { passive: true });
      (node as any)._scrollHandler = handleScroll;

      if (pendingScrollRef.current && sessionId) {
        pendingScrollRef.current = false;
        scrollToBottom("instant");
      }
    }
  }, [isStreaming, scrollToBottom, sessionId]);

  useEffect(() => {
    const el = containerRefInternal.current;
    if (el && (el as any)._scrollHandler) {
      const handler = (el as any)._scrollHandler;
      el.removeEventListener("scroll", handler);
      delete (el as any)._scrollHandler;
    }
    return () => {
      if (el && (el as any)._scrollHandler) {
        const handler = (el as any)._scrollHandler;
        el.removeEventListener("scroll", handler);
      }
    };
  }, [containerRefCallback]);

  useEffect(() => {
    const el = getContainer();
    if (!el) return;

    const isNewMessage = messagesLength !== lastMessagesLength.current;
    lastMessagesLength.current = messagesLength;

    if (isNewMessage && messagesLength > 0 && !userScrolledRef.current) {
      scrollToBottom("instant");
    }
  }, [messagesLength, scrollToBottom, getContainer]);

  useEffect(() => {
    const el = getContainer();
    if (!el) return;

    const isContentGrowing = (streamingContentLength ?? 0) !== lastStreamingContentLength.current;
    lastStreamingContentLength.current = streamingContentLength ?? 0;

    if (isStreaming && isContentGrowing) {
      scrollToBottom("smooth");
    }
  }, [isStreaming, streamingContentLength, scrollToBottom, getContainer]);

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

      const el = getContainer();
      if (el) {
        pendingScrollRef.current = false;
        scrollToBottom("instant");
      }
    }
  }, [sessionId, scrollToBottom, getContainer]);

  return {
    containerRef: containerRefCallback,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
    scrollToTop,
  };
}
