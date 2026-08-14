'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback } from 'react';
import { ChatInput } from '@/components/chat/chat-input';
import { EmptyState } from '@/components/chat/empty-state';
import { MessageList } from '@/components/chat/message-list';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useChatStore } from '@/stores/chat-store';
import { useSessionStore } from '@/stores/session-store';
import { SessionList } from './SessionList';
import { SidebarFooter as AppSidebarFooter } from './SidebarFooter';
import { SidebarHeader as AppSidebarHeader } from './SidebarHeader';

interface ChatContentProps {
  sessionId: string | null;
}

function ChatContent({ sessionId }: ChatContentProps) {
  const router = useRouter();
  const _searchParams = useSearchParams();
  const { sessions, fetchSessions, createSession } = useSessionStore();
  const { messages, isStreaming, fetchMessages, sendMessage, stopStream } = useChatStore();

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  React.useEffect(() => {
    if (sessionId) {
      fetchMessages(sessionId);
    }
  }, [sessionId, fetchMessages]);

  const handleSend = useCallback(
    (content: string, model: string) => {
      if (sessionId) {
        sendMessage(sessionId, content, model);
      }
    },
    [sessionId, sendMessage]
  );

  const handleStop = useCallback(() => {
    if (sessionId) {
      stopStream(sessionId);
    }
  }, [sessionId, stopStream]);

  const _handleNewChat = useCallback(async () => {
    const newSessionId = await createSession('MiniMax-M2.7');
    router.push(`/?sessionId=${newSessionId}`);
  }, [createSession, router]);

  const session = sessions.find((s) => s.id === sessionId);
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex flex-col h-screen">
      {hasMessages ? (
        <div className="flex flex-col flex-1 border rounded-xl m-4 overflow-hidden">
          <MessageList messages={messages} />
          <div className="shrink-0 px-4 pb-4">
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
          <EmptyState />
        </div>
      )}
    </div>
  );
}

interface AppSidebarProps {
  sessionId?: string | null;
}

const DEFAULT_LIMIT = 10;

function AppSidebar(_props: AppSidebarProps) {
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
      <SidebarInset>{children}</SidebarInset>
      <SidebarRail />
    </SidebarProvider>
  );
}

interface ChatPageContentProps {
  sessionId: string | null;
}

export function ChatPageContent({ sessionId }: ChatPageContentProps) {
  return (
    <Suspense
      fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}
    >
      <ChatContent sessionId={sessionId} />
    </Suspense>
  );
}
