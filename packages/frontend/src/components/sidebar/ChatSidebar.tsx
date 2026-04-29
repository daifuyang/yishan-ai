"use client";

import React from "react";
import { useRouter } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  SidebarProvider,
  SidebarInset,
  SidebarRail,
} from "@/components/ui/sidebar";

import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { SidebarHeader as AppSidebarHeader } from "./SidebarHeader";
import { SessionList } from "./SessionList";
import { SidebarFooter as AppSidebarFooter } from "./SidebarFooter";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface ChatContentProps {
  sessionId: string | null;
}

function ChatContent({ sessionId }: ChatContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessions, fetchSessions, createSession } = useSessionStore();
  const { messages, isStreaming, streamingContent, fetchMessages, sendMessage, stopStream } = useChatStore();

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  React.useEffect(() => {
    if (sessionId) {
      fetchMessages(sessionId);
    }
  }, [sessionId, fetchMessages]);

  const handleSend = (content: string, model: string, mode: "plan" | "build") => {
    if (sessionId) {
      sendMessage(sessionId, content, model, mode);
    }
  };

  const handleStop = () => {
    if (sessionId) {
      stopStream(sessionId);
    }
  };

  const handleNewChat = async () => {
    const newSessionId = await createSession("MiniMax-M2.7");
    router.push(`/?id=${newSessionId}`);
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
            defaultModel={session?.model}
          />
        </>
      ) : (
        <>
          <EmptyState onNewChat={handleNewChat} />
          <div className="border-t p-4">
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              defaultModel={session?.model}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface AppSidebarProps {
  sessionId: string | null;
}

function AppSidebar({ sessionId }: AppSidebarProps) {
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

interface ChatLayoutProps {
  children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar sessionId={null} />
      <SidebarInset>
        {children}
      </SidebarInset>
      <SidebarRail />
    </SidebarProvider>
  );
}

interface ChatPageContentProps {
  sessionId: string | null;
}

export function ChatPageContent({ sessionId }: ChatPageContentProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ChatContent sessionId={sessionId} />
    </Suspense>
  );
}