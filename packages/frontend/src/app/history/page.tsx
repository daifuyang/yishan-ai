"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, MessageSquare, Search, X } from "lucide-react";
import { useSessionStore, Session } from "@/stores/session-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { cn } from "@/lib/utils";

function SessionItem({ session, onDelete }: { session: Session; onDelete: (id: string) => void }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group",
        "hover:bg-muted"
      )}
    >
      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
      <Link
        href={`/?sessionId=${session.id}`}
        className="flex-1 text-sm truncate hover:text-foreground"
      >
        {session.title || "新对话"}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
        onClick={() => onDelete(session.id)}
      >
        <Trash2 className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

function HistoryContent() {
  const router = useRouter();
  const { sessions, fetchSessions, deleteSession } = useSessionStore();
  const [searchQuery, setSearchQuery] = useState("");

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((s) =>
      (s.title || "新对话").toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSession(id);
  }, [deleteSession]);

  const handleBack = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4">
        <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-base font-semibold">历史会话</h1>
        <span className="text-sm text-muted-foreground">
          ({filteredSessions.length})
        </span>
      </header>

      <div className="px-6 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索历史会话"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
              <p>{searchQuery ? "未找到匹配的会话" : "暂无会话记录"}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <ChatLayout>
      <HistoryContent />
    </ChatLayout>
  );
}
