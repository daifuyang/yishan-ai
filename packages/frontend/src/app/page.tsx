"use client";

import React, { Suspense, useCallback, useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const { sessions, createSession, fetchSessions } = useSessionStore();
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

  const hasMessages = messages.length > 0 || isStreaming;
  const shouldShowLoading = isLoading || Boolean(sessionId && !sessions.find((s) => s.id === sessionId));
  const isCreating = isCreatingSession || isPending;
  const session = sessions.find((s) => s.id === sessionId);

  const { containerRef, showScrollButton, scrollToBottom } = useChatScroll({
    messagesLength: messages.length,
    isStreaming,
    streamingContentLength: streamingContent?.length ?? 0,
    sessionId,
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

  // Load messages when session changes
  React.useEffect(() => {
    if (sessionId) {
      console.log('[page] sessionId changed:', sessionId);
      setIsLoading(true);
      fetchMessages(sessionId)
        .then(() => {
          console.log('[page] fetchMessages resolved, calling scrollToBottom, messages.length:', messages.length);
          scrollToBottom("instant");
        })
        .catch(() => {
          router.push("/");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      clearMessages();
    }
  }, [sessionId, fetchMessages, clearMessages, router, scrollToBottom]);

  const handleSend = useCallback(
    async (content: string, model: string, mode: "plan" | "build") => {
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
    },
    [sessionId, createSession, sendMessage, router]
  );

  const handleStop = useCallback(() => {
    if (sessionId) {
      stopStream(sessionId);
    }
  }, [sessionId, stopStream]);

  const handleRollback = useCallback(
    async (messageId: string, content: string) => {
      if (!sessionId) return;
      await rollbackMessage(sessionId, messageId);
      setRollbackContent(content);
    },
    [sessionId, rollbackMessage]
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
