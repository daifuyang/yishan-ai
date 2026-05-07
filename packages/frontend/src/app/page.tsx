"use client";

import React, { Suspense, useCallback, useState, useTransition, useRef, useEffect, useLayoutEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ChatLayout } from "@/components/layout/ChatLayout";
import { useSidebar } from "@/components/ui/sidebar";
import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { useConfigStore } from "@/stores/config-store";
import { MessageList } from "@/components/chat/message-list";
import { ChatInputWrapper } from "@/components/chat/chat-input-wrapper";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatHeader } from "@/components/chat/chat-header";
import { toast } from "sonner";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Menu, Edit } from 'lucide-react';

function ChatContent({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { sessions, createSession, fetchSessions } = useSessionStore();
  const { isMobile, setOpenMobile, openMobile, toggleSidebar, state } = useSidebar();
  const { messages, isStreaming, streamingContent, errorMessage, fetchMessages, sendMessage, stopStream, clearMessages, rollbackMessage, clearError } = useChatStore();
  const { fetchConfig } = useConfigStore();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rollbackContent, setRollbackContent] = useState<string | undefined>();
  const chatInputRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ isNearTop: true, isNearBottom: false, canScroll: false });
  const [showTopButton, setShowTopButton] = useState(false);
  const userScrolledAwayRef = useRef(false);

  useEffect(() => {
    const updateScrollState = () => {
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const distanceFromBottom = scrollHeight - scrollY - clientHeight;

      setScrollState({
        isNearTop: scrollY < 100,
        isNearBottom: distanceFromBottom < 100,
        canScroll: scrollHeight > clientHeight,
      });
    };

    const handleScroll = () => {
      updateScrollState();
      const distanceFromBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;

      if (distanceFromBottom >= 100) {
        userScrolledAwayRef.current = true;
      } else {
        userScrolledAwayRef.current = false;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollState();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    setScrollState(prev => ({
      ...prev,
      canScroll: scrollHeight > clientHeight,
    }));
  }, [messages]);

  useEffect(() => {
    const shouldShowTop = !scrollState.isNearTop && !scrollState.isNearBottom;

    if (shouldShowTop !== showTopButton) {
      setShowTopButton(shouldShowTop);
    }
  }, [scrollState.isNearTop, scrollState.isNearBottom]);

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage);
      clearError();
    }
  }, [errorMessage, clearError]);

  useEffect(() => {
    fetchConfig();
    fetchSessions();
  }, [fetchConfig, fetchSessions]);

  useEffect(() => {
    if (sessionId) {
      setIsLoading(true);
      fetchMessages(sessionId)
        .catch(() => {
          router.push('/');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      clearMessages();
    }
  }, [sessionId, fetchMessages, clearMessages, router]);

  useLayoutEffect(() => {
    if (chatInputRef.current) {
      console.log(chatInputRef.current.getBoundingClientRect());
    }
  }, [messages]);

  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (messages.length > 0 && messages.length !== prevMessagesLength.current) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (isStreaming && !userScrolledAwayRef.current) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  }, [isStreaming, streamingContent]);

  useEffect(() => {
    if (!isStreaming) {
      userScrolledAwayRef.current = false;
    }
  }, [isStreaming]);

  const handleSend = useCallback(async (content: string, model: string, mode: "plan" | "build") => {
    setRollbackContent(undefined);
    if (!sessionId) {
      setIsCreatingSession(true);
      const newSessionId = await createSession(model);
      await sendMessage(newSessionId, content, model, mode);
      setIsCreatingSession(false);
      startTransition(() => {
        router.push(`/?sessionId=${newSessionId}`);
      });
    } else {
      sendMessage(sessionId, content, model, mode);
    }
  }, [sessionId, createSession, sendMessage, router]);

  const handleStop = useCallback(() => {
    if (sessionId) {
      stopStream(sessionId);
    }
  }, [sessionId, stopStream]);

  const handleRollback = useCallback(async (messageId: string, content: string) => {
    if (!sessionId) return;
    await rollbackMessage(sessionId, messageId);
    setRollbackContent(content);
  }, [sessionId, rollbackMessage]);

  const session = sessions.find((s) => s.id === sessionId);
  const hasMessages = messages.length > 0 || isStreaming;

  console.log('hasMessages', hasMessages);

  const shouldShowLoading = isLoading || (sessionId && !session);
  const isCreating = isCreatingSession || isPending;

  return (
    <>
      {hasMessages ? (
        <div className="min-h-screen flex flex-col">
          {session && <ChatHeader title={session.title} />}
          <div className="w-full flex-1 max-w-3xl mx-auto px-4 sm:px-6">
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              onRollback={handleRollback}
            />
          </div>
          <div className="sticky bottom-0 shrink-0 pb-4 pt-2 bg-background">
            {scrollState.canScroll && (
              <div className="relative w-full max-w-3xl mx-auto">
                <div className="absolute right-6 top-0 flex flex-col gap-2">
                  {showTopButton && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="h-8 w-8 bg-background/95 backdrop-blur shadow-sm"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => scrollState.isNearBottom
                      ? window.scrollTo({ top: 0, behavior: 'smooth' })
                      : window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
                    className="h-8 w-8 bg-background/95 backdrop-blur shadow-sm"
                  >
                    {scrollState.isNearBottom ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
            <ChatInputWrapper
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              disabled={isCreating}
              defaultModel={session?.model}
              initialContent={rollbackContent}
            />
          </div>
        </div>
      ) : shouldShowLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
            <div className="flex items-center h-14 pl-4 pr-4 sm:pl-6 sm:pr-6 group">
              <div className="shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    if (isMobile) {
                      setOpenMobile(!openMobile);
                    } else {
                      toggleSidebar();
                    }
                  }}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex-1 flex justify-start">
                <div className="flex items-center gap-2 group">
                  <h1 className="text-sm font-medium truncate">
                    {session?.title || '新对话'}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="shrink-0 h-9 w-9" />
            </div>
          </div>
          <div className="flex-1 py-8">
            <EmptyState
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              disabled={isCreating}
              defaultModel={session?.model}
              initialContent={rollbackContent}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ChatContentWithParams() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return <ChatContent sessionId={sessionId} />;
}

export default function HomePage() {
  return (
    <ChatLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <ChatContentWithParams />
      </Suspense>
    </ChatLayout>
  );
}
