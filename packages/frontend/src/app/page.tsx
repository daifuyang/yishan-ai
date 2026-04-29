"use client";

import React, { Suspense, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ChatLayout } from "@/components/layout/ChatLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";

function ChatContent({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const { sessions, fetchSessions, createSession } = useSessionStore();
  const { messages, isStreaming, streamingContent, fetchMessages, sendMessage, stopStream, clearMessages } = useChatStore();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  React.useEffect(() => {
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
    if (!sessionId) {
      setIsCreatingSession(true);
      const newSessionId = await createSession(model);
      await sendMessage(newSessionId, content, model, mode);
      router.push(`/?sessionId=${newSessionId}`);
      setIsCreatingSession(false);
    } else {
      sendMessage(sessionId, content, model, mode);
    }
  }, [sessionId, createSession, sendMessage, router]);

  const handleStop = useCallback(() => {
    if (sessionId) {
      stopStream(sessionId);
    }
  }, [sessionId, stopStream]);

  const session = sessions.find((s) => s.id === sessionId);
  const hasMessages = messages.length > 0 || isStreaming;

  const shouldShowLoading = isLoading || (sessionId && !session);

  return (
    <div className="flex flex-col h-screen">
      {!sessionId && !hasMessages ? (
        <div className="flex-1 p-4">
          <EmptyState
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={isCreatingSession}
            defaultModel={session?.model}
          />
        </div>
      ) : shouldShowLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex flex-col h-full m-4">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
          />
          <div className="shrink-0 px-4 pb-4">
            <div className="max-w-2xl mx-auto">
              <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
                disabled={isCreatingSession}
                defaultModel={session?.model}
              />
            </div>
          </div>
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
