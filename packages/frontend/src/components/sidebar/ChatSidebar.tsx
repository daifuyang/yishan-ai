"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

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

  const handleSend = useCallback((content: string, model: string, mode: "plan" | "build") => {
    if (sessionId) {
      sendMessage(sessionId, content, model, mode);
    }
  }, [sessionId, sendMessage]);

  const handleStop = useCallback(() => {
    if (sessionId) {
      stopStream(sessionId);
    }
  }, [sessionId, stopStream]);

  const handleNewChat = useCallback(async () => {
    const newSessionId = await createSession("MiniMax-M2.7");
    router.push(`/?sessionId=${newSessionId}`);
  }, [createSession, router]);

  const session = sessions.find((s) => s.id === sessionId);
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex flex-col h-screen">
      {hasMessages ? (
        <div className="flex flex-col h-full border rounded-xl m-4 overflow-hidden">
          <ScrollArea className="flex-1">
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
            />
          </ScrollArea>
          <div className="shrink-0">
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              defaultModel={session?.model}
              noBorder
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4">
          <EmptyState
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={false}
            defaultModel={session?.model}
          />
        </div>
      )}
    </div>
  );
}

interface AppSidebarProps {
  sessionId: string | null;
}

const DEFAULT_LIMIT = 10;

function AppSidebar({ sessionId }: AppSidebarProps) {
  const { sessions, fetchSessions } = useSessionStore();
  const totalCount = sessions.length;
  const hasMore = totalCount > DEFAULT_LIMIT;

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
        {hasMore && (
          <div className="px-3 py-2 border-t">
            <Link
              href="/history"
              className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>查看全部 ({totalCount})</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
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