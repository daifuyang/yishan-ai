"use client";

import React, { Suspense, useCallback, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ChatLayout } from "@/components/layout/ChatLayout";
import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { useConfigStore } from "@/stores/config-store";
import { MessageList } from "@/components/chat/message-list";
import { ChatInputWrapper } from "@/components/chat/chat-input-wrapper";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatHeader } from "@/components/chat/chat-header";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

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
  const shouldShowLoading = isLoading || (sessionId && !sessions.find((s) => s.id === sessionId));
  const isCreating = isCreatingSession || isPending;
  const session = sessions.find((s) => s.id === sessionId);

  const {
    containerRef,
    showScrollButton,
    scrollToBottom,
  } = useChatScroll({
    messagesLength: messages.length,
    isStreaming,
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
      setIsLoading(true);
      fetchMessages(sessionId)
        .catch(() => {
          router.push("/");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      clearMessages();
    }
  }, [sessionId, fetchMessages, clearMessages, router]);

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

  return (
    <div className="flex flex-col h-dvh">
      <ChatHeader title={session?.title || "新对话"} />

      <div className="flex-1 overflow-hidden relative">
        {shouldShowLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div
            ref={containerRef}
            className="h-full overflow-y-auto scrollbar-thin scroll-smooth"
          >
            {hasMessages ? (
              <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-4">
                <MessageList
                  messages={messages}
                  isStreaming={isStreaming}
                  streamingContent={streamingContent}
                  onRollback={handleRollback}
                />
              </div>
            ) : (
              <EmptyState
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
                disabled={isCreating}
                defaultModel={session?.model}
                initialContent={rollbackContent}
              />
            )}
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-4 right-6 h-9 w-9 rounded-full bg-background/95 backdrop-blur shadow-md border-muted-foreground/20"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl mx-auto p-4">
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
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        }
      >
        <ChatContentWithParams />
      </Suspense>
    </ChatLayout>
  );
}
