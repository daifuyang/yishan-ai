"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseChatScrollOptions {
  messagesLength: number;
  isStreaming: boolean;
}

export function useChatScroll({ messagesLength, isStreaming }: UseChatScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledRef = useRef(false);
  const lastMessagesLength = useRef(messagesLength);

  const checkIsAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const threshold = 80;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior });
  }, []);

  // Handle scroll events to detect user manually scrolling away
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const atBottom = checkIsAtBottom();
      setIsAtBottom(atBottom);
      setShowScrollButton(!atBottom);

      if (!atBottom) {
        userScrolledRef.current = true;
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [checkIsAtBottom]);

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNewMessage = messagesLength !== lastMessagesLength.current;
    lastMessagesLength.current = messagesLength;

    if (isNewMessage && messagesLength > 0) {
      if (userScrolledRef.current) {
        // User has scrolled away, don't auto-scroll
        return;
      }
      scrollToBottom("instant");
    }
  }, [messagesLength, scrollToBottom]);

  // Auto-scroll during streaming if user hasn't manually scrolled away
  useEffect(() => {
    if (isStreaming && !userScrolledRef.current) {
      scrollToBottom("smooth");
    }
  }, [isStreaming, scrollToBottom]);

  // Reset userScrolled when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      userScrolledRef.current = false;
    }
  }, [isStreaming]);

  // Initial scroll to bottom when first messages load
  useEffect(() => {
    if (messagesLength > 0) {
      scrollToBottom("instant");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    containerRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
    scrollToTop,
  };
}
