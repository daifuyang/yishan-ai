"use client";

import React, { Suspense, useState } from "react";
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

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  React.useEffect(() => {
    if (sessionId) {
      fetchMessages(sessionId);
    } else {
      clearMessages();
    }
  }, [sessionId, fetchMessages, clearMessages]);

  const handleSend = async (content: string, model: string, mode: "plan" | "build") => {
    if (!sessionId) {
      setIsCreatingSession(true);
      const newSessionId = await createSession(model);
      await sendMessage(newSessionId, content, model, mode);
      router.push(`/?sessionId=${newSessionId}`);
      setIsCreatingSession(false);
    } else {
      sendMessage(sessionId, content, model, mode);
    }
  };

  const handleStop = () => {
    if (sessionId) {
      stopStream(sessionId);
    }
  };

  const session = sessions.find((s) => s.id === sessionId);
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex flex-col h-screen">
      {hasMessages ? (
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
      ) : (
        <div className="flex-1 p-4">
          <EmptyState
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={isCreatingSession}
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
