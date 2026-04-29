"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useSessionStore, Session } from "@/stores/session-store";
import { DEFAULT_SESSION_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";

function SessionItem({ session }: { session: Session }) {
  const searchParams = useSearchParams();
  const isActive = searchParams.get("sessionId") === session.id;

  return (
    <Link
      href={`/?sessionId=${session.id}`}
      className={cn(
        "block px-3 py-2 text-sm rounded-md transition-all truncate",
        !isActive && "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-foreground",
        isActive && "bg-black text-white font-medium"
      )}
    >
      {session.title || "新对话"}
    </Link>
  );
}

function SessionListInner() {
  const { sessions } = useSessionStore();
  const displaySessions = sessions.slice(0, DEFAULT_SESSION_LIMIT);

  return (
    <div className="flex flex-col px-3 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <p>暂无会话记录</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {displaySessions.map((session) => (
              <SessionItem key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SessionList() {
  return (
    <Suspense fallback={<div className="px-3 py-2 text-sm text-muted-foreground">加载中...</div>}>
      <SessionListInner />
    </Suspense>
  );
}