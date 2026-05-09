"use client";

import React, { Suspense, useCallback, useState } from "react";
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
import { toast } from "sonner";

function ChatContent({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const { sessions, activeId, createSession, fetchSessions, setActiveId } = useSessionStore();
  const {
    messages,
    isStreaming,
    streamingContent,
    errorMessage,
    fetchMessages,
    sendMessage,
    stopStream,
    clearMessages,
    rollbackMessage,
    clearError,
  } = useChatStore();
  const { fetchConfig } = useConfigStore();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rollbackContent, setRollbackContent] = useState<string | undefined>();
  const initActiveIdRef = React.useRef<string | null>(null);

  const hasMessages = messages.length > 0 || isStreaming;
  const shouldShowLoading = isLoading || Boolean(activeId && !sessions.find((s) => s.id === activeId));
  const isCreating = isCreatingSession;
  const session = sessions.find((s) => s.id === activeId);

  const { containerRef, showScrollButton, scrollToBottom } = useChatScroll({
    messagesLength: messages.length,
    isStreaming,
    streamingContentLength: streamingContent?.length ?? 0,
    sessionId: activeId,
  });

  // Error handling
  React.useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage);
      clearError();
    }
  }, [errorMessage, clearError]);

  // Initial data fetch
  React.useEffect(() => {
    fetchConfig();
    fetchSessions();
  }, [fetchConfig, fetchSessions]);

  // Sync activeId from URL only on initial mount
  React.useEffect(() => {
    if (initActiveIdRef.current === null) {
      if (sessionId) {
        setActiveId(sessionId);
      }
      initActiveIdRef.current = sessionId;
    }
  }, [sessionId, setActiveId]);

  // Load messages when activeId changes
  React.useEffect(() => {
    if (initActiveIdRef.current === null) {
      return;
    }
    if (activeId && activeId !== initActiveIdRef.current) {
      initActiveIdRef.current = activeId;
      console.log('[page] activeId changed:', activeId);
      setIsLoading(true);
      fetchMessages(activeId)
        .then(() => {
          console.log('[page] fetchMessages resolved, calling scrollToBottom');
          scrollToBottom("instant");
        })
        .catch(() => {
          setActiveId(null);
          initActiveIdRef.current = null;
          router.push("/");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [activeId, fetchMessages, scrollToBottom, setActiveId, router]);

  const handleSend = useCallback(
    async (content: string, model: string, mode: "plan" | "build") => {
      setRollbackContent(undefined);
      if (!activeId) {
        setIsCreatingSession(true);
        const newSessionId = await createSession(model);
        await sendMessage(newSessionId, content, model, mode);
        setIsCreatingSession(false);
        setActiveId(newSessionId);
      } else {
        sendMessage(activeId, content, model, mode);
      }
    },
    [activeId, createSession, sendMessage, setActiveId]
  );

  const handleStop = useCallback(() => {
    if (activeId) {
      stopStream(activeId);
    }
  }, [activeId, stopStream]);

  const handleRollback = useCallback(
    async (messageId: string, content: string) => {
      if (!activeId) return;
      await rollbackMessage(activeId, messageId);
      setRollbackContent(content);
    },
    [activeId, rollbackMessage]
  );

  const inputNode = (
    <ChatInputWrapper
      onSend={handleSend}
      onStop={handleStop}
      isStreaming={isStreaming}
      disabled={isCreating}
      defaultModel={session?.model}
      initialContent={rollbackContent}
      showPadding={false}
    />
  );

  return (
    <div className="flex flex-col h-dvh">
      <ChatHeader title={session?.title || "新对话"} />

      <ChatMain
        hasMessages={hasMessages}
        shouldShowLoading={shouldShowLoading}
        containerRef={containerRef}
        showScrollButton={showScrollButton}
        scrollToBottom={scrollToBottom}
        messages={
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onRollback={handleRollback}
          />
        }
        input={inputNode}
      />
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
          <div className="flex items-center justify-center h-dvh">
            <LoadingSpinner />
          </div>
        }
      >
        <ChatContentWithParams />
      </Suspense>
    </ChatLayout>
  );
}
