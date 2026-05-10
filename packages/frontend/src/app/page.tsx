"use client";

import React, { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ChatLayout } from "@/components/layout/ChatLayout";
import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { useConfigStore } from "@/stores/config-store";
import { MessageList } from "@/components/chat/message-list";
import { ChatInputWrapper } from "@/components/chat/chat-input-wrapper";
import { ChatMain } from "@/components/chat/chat-main";
import { ChatHeader } from "@/components/chat/chat-header";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

function ChatContent({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const { sessions, activeId, createSession, deleteSession, fetchSessions, setActiveId } = useSessionStore();
  const {
    messages,
    isStreaming,
    isFetchingMessages,
    streamingContent,
    fetchMessages,
    sendMessage,
    retryMessage,
    stopStream,
    clearMessages,
    rollbackMessage,
  } = useChatStore();



  const { fetchConfig } = useConfigStore();

  const session = sessions.find((s) => s.id === activeId);
  const prevSessionIdRef = React.useRef<string | null>(null);

  const { containerRef, showScrollButton, scrollToBottom } = useChatScroll({
    messagesLength: messages.length,
    isStreaming,
    streamingContentLength: streamingContent?.length ?? 0,
    sessionId: activeId,
  });

  React.useEffect(() => {
    if (!sessionId) {
      setActiveId(null);
      clearMessages();
      prevSessionIdRef.current = null;
      return;
    }

    let cancelled = false;

    setActiveId(sessionId);

    const isNewSession = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    fetchMessages(sessionId)
      .then(() => {
        if (cancelled) return;
        scrollToBottom("instant");

        if (isNewSession) {
          const pendingKey = `pending_message_${sessionId}`;
          const pendingData = sessionStorage.getItem(pendingKey);
          if (pendingData) {
            sessionStorage.removeItem(pendingKey);
            const { content, model, mode } = JSON.parse(pendingData);
            sendMessage(sessionId, content, model, mode);
          }
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to fetch messages:', error);
        clearMessages();
        setActiveId(null);
        router.push("/");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, setActiveId, fetchMessages, scrollToBottom, clearMessages, router, sendMessage]);

  const handleSend = useCallback(
    async (content: string, model: string, mode: "plan" | "build") => {
      if (!activeId) {
        const createResult = await createSession(model);

        if (!createResult.success || !createResult.sessionId) {
          return;
        }

        const newSessionId = createResult.sessionId;
        sessionStorage.setItem(
          `pending_message_${newSessionId}`,
          JSON.stringify({ content, model, mode })
        );

        router.push(`/?sessionId=${newSessionId}`);
      } else {
        sendMessage(activeId, content, model, mode);
      }
    },
    [activeId, createSession, sendMessage, router]
  );

  const handleRetry = useCallback(
    async (messageId: string, model: string, mode: "plan" | "build") => {
      if (!activeId) return;
      retryMessage(activeId, messageId, model, mode);
    },
    [activeId, retryMessage]
  );

  const handleStop = useCallback(() => {
    if (activeId) {
      stopStream(activeId);
    }
  }, [activeId, stopStream]);

  const handleRollback = useCallback(
    async (messageId: string, content: string) => {
      if (!activeId) return;
      rollbackMessage(activeId, messageId);
    },
    [activeId, rollbackMessage]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      clearMessages();
      router.push("/");
    },
    [deleteSession, clearMessages, router]
  );

  const hasMessages = messages.length > 0 || isStreaming;
  const shouldShowLoading = isFetchingMessages && !messages.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        title={session?.title || "新对话"}
        onDelete={activeId ? () => handleDeleteSession(activeId) : undefined}
        onTitleClick={() => router.push("/")}
      />

      <ChatMain
        hasMessages={hasMessages}
        shouldShowLoading={shouldShowLoading}
        containerRef={containerRef}
        showScrollButton={showScrollButton}
        scrollToBottom={scrollToBottom}
        messages={
          <MessageList
            messages={messages}
            onRollback={handleRollback}
            onRetry={handleRetry}
          />
        }
      />

      <div className="shrink-0">
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:p-4">
          <div className="max-w-3xl mx-auto p-4 pb-[calc(16px+env(safe-area-inset-bottom))] md:pb-[calc(16px+env(safe-area-inset-bottom))]">
            <ChatInputWrapper
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              disabled={isStreaming}
              defaultModel={session?.model}
              showPadding={false}
            />
          </div>
        </div>
      </div>
    </div>
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
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner />
          </div>
        }
      >
        <ChatContentWithParams />
      </Suspense>
    </ChatLayout>
  );
}
