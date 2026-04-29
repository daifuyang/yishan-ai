"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarInset,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { SidebarHeader as AppSidebarHeader } from "@/components/sidebar/SidebarHeader";
import { SessionList } from "@/components/sidebar/SessionList";
import { SidebarFooter as AppSidebarFooter } from "@/components/sidebar/SidebarFooter";

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
      router.push(`/?id=${newSessionId}`);
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
        <>
          <ScrollArea className="flex-1">
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
            />
          </ScrollArea>
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={isCreatingSession}
            defaultModel={session?.model}
          />
        </>
      ) : (
        <>
          <EmptyState />
          <div className="border-t p-4">
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              disabled={isCreatingSession}
              defaultModel={session?.model}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ChatContentWithParams() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  return <ChatContent sessionId={sessionId} />;
}

function AppSidebar() {
  const { fetchSessions } = useSessionStore();

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader>
        <AppSidebarHeader />
      </SidebarHeader>
      <SidebarContent>
        <Separator className="mb-2" />
        <SessionList />
      </SidebarContent>
      <SidebarFooter>
        <AppSidebarFooter />
      </SidebarFooter>
    </Sidebar>
  );
}

export default function HomePage() {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <ChatContentWithParams />
        </Suspense>
      </SidebarInset>
      <SidebarRail />
    </SidebarProvider>
  );
}