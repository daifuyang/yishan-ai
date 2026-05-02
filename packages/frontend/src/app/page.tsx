"use client";

import React, { Suspense, useCallback, useState, useTransition, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ChatLayout } from "@/components/layout/ChatLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { useConfigStore } from "@/stores/config-store";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";

function ChatContent({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { sessions, createSession, fetchSessions } = useSessionStore();
  const { messages, isStreaming, streamingContent, fetchMessages, sendMessage, stopStream, clearMessages, rollbackMessage } = useChatStore();
  const { fetchConfig } = useConfigStore();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rollbackContent, setRollbackContent] = useState<string | undefined>();

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

  const shouldShowLoading = isLoading || (sessionId && !session);
  const isCreating = isCreatingSession || isPending;

  return (
    <div className="flex flex-col h-screen">
      {hasMessages ? (
        <div className="flex flex-col h-full">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onRollback={handleRollback}
          />
          <div className="shrink-0 px-6 pb-6 pt-2">
            <div className="max-w-3xl mx-auto">
              <ChatInput
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
      ) : shouldShowLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex-1 px-6 py-8">
          <EmptyState
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={isCreating}
            defaultModel={session?.model}
          />
        </div>
      )}
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
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <ChatContentWithParams />
      </Suspense>
    </ChatLayout>
  );
}
