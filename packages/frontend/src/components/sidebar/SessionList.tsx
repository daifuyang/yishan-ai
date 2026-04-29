"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";

import { useSessionStore, Session } from "@/stores/session-store";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

function SessionItem({ session }: { session: Session }) {
  const pathname = usePathname();
  const { deleteSession } = useSessionStore();
  const isActive = pathname === `/?id=${session.id}`;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteSession(session.id);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={`/?id=${session.id}`}>
          <MessageSquare data-icon="inline-start" />
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="truncate">{session.title || "新对话"}</span>
            <span className="text-xs text-muted-foreground truncate">
              {formatTime(session.updatedAt)}
            </span>
          </div>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function SessionList() {
  const { sessions } = useSessionStore();

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
        <p>暂无会话记录</p>
      </div>
    );
  }

  const groupedSessions = sessions.reduce((groups, session) => {
    const date = new Date(session.updatedAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    let group: string;
    if (days === 0) group = "今天";
    else if (days === 1) group = "昨天";
    else if (days < 7) group = "最近七天";
    else group = "更早";

    if (!groups[group]) groups[group] = [];
    groups[group].push(session);
    return groups;
  }, {} as Record<string, Session[]>);

  return (
    <ScrollArea className="flex-1">
      {Object.entries(groupedSessions).map(([group, groupSessions]) => (
        <div key={group} className="mb-4">
          <p className="px-2 text-xs font-medium text-muted-foreground mb-1">
            {group}
          </p>
          <SidebarMenu>
            {groupSessions.map((session) => (
              <SessionItem key={session.id} session={session} />
            ))}
          </SidebarMenu>
        </div>
      ))}
    </ScrollArea>
  );
}