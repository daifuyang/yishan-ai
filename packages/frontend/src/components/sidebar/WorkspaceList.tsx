'use client';

import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { type Session, useSessionStore } from '@/stores/session-store';

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function ConversationItem({ session }: { session: Session }) {
  const searchParams = useSearchParams();
  const isActive = searchParams.get('sessionId') === session.id;
  const { updateSession, deleteSession } = useSessionStore();
  const { setOpenMobile } = useSidebar();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title);

  const handleSaveTitle = useCallback(async () => {
    if (newTitle.trim() && newTitle !== session.title) {
      await updateSession(session.id, { title: newTitle.trim() });
    }
    setEditOpen(false);
  }, [newTitle, session.id, session.title, updateSession]);

  const handleTogglePin = useCallback(async () => {
    await updateSession(session.id, { isPinned: !session.isPinned });
  }, [session.id, session.isPinned, updateSession]);

  const handleDelete = useCallback(async () => {
    await deleteSession(session.id);
    setDeleteOpen(false);
  }, [deleteSession, session.id]);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover needed */}
      <div
        className={cn(
          'flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-lg transition-colors group/conv',
          isActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Link
          href={`/?sessionId=${session.id}`}
          className="flex-1 flex items-center justify-between min-w-0"
          onClick={() => setOpenMobile(false)}
        >
          <span className="text-sm truncate">{session.title || '新对话'}</span>
          <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-2">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </Link>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6 shrink-0 transition-opacity bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground',
                hovered || menuOpen ? 'opacity-100' : 'opacity-0'
              )}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setNewTitle(session.title);
                setEditOpen(true);
                setMenuOpen(false);
              }}
            >
              <DropdownMenuItemIcon>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuItemIcon>
              编辑标题
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleTogglePin();
              }}
            >
              <DropdownMenuItemIcon>
                {session.isPinned ? (
                  <PinOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Pin className="h-4 w-4 text-muted-foreground" />
                )}
              </DropdownMenuItemIcon>
              {session.isPinned ? '取消置顶' : '置顶'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setDeleteOpen(true);
                setMenuOpen(false);
              }}
              className="text-red-600 focus:text-red-600"
            >
              <DropdownMenuItemIcon>
                <Trash2 className="h-4 w-4" />
              </DropdownMenuItemIcon>
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标题</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTitle}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>删除后无法恢复，确定要删除这个会话吗？</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function WorkspaceItem({
  workspacePath,
  sessions,
}: {
  workspacePath: string;
  sessions: Session[];
}) {
  const [expanded, setExpanded] = useState(true);
  const label = workspacePath
    ? workspacePath.split('/').filter(Boolean).pop() || workspacePath
    : '未设置工作目录';

  return (
    <div className="mb-1">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg',
          'text-sm font-medium text-sidebar-foreground/80',
          'hover:bg-sidebar-accent transition-colors'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
        )}
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60" />
        <span className="truncate">{label}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-0.5 mt-0.5 animate-in fade-in duration-100">
          {sessions.map((session) => (
            <ConversationItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceListInner({ searchQuery }: { searchQuery: string }) {
  const { sessions, fetchSessions } = useSessionStore();

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) => s.title.toLowerCase().includes(q) || s.cwd?.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const key = s.cwd || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(s);
    }
    const groups: { path: string; sessions: Session[] }[] = [];
    for (const [path, items] of map) {
      groups.push({ path, sessions: items });
    }
    groups.sort((a, b) => {
      if (!a.path && b.path) return 1;
      if (a.path && !b.path) return -1;
      const aLatest = Math.max(...a.sessions.map((s) => s.updatedAt));
      const bLatest = Math.max(...b.sessions.map((s) => s.updatedAt));
      return bLatest - aLatest;
    });
    return groups;
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-muted-foreground text-sm">
        <p>{searchQuery ? '未找到匹配项' : '暂无会话'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-2 py-1">
      {grouped.map((group) => (
        <WorkspaceItem
          key={group.path || '__none__'}
          workspacePath={group.path}
          sessions={group.sessions}
        />
      ))}
    </div>
  );
}

export function WorkspaceList({ searchQuery }: { searchQuery: string }) {
  return (
    <Suspense fallback={<div className="px-4 py-2 text-sm text-muted-foreground">加载中...</div>}>
      <WorkspaceListInner searchQuery={searchQuery} />
    </Suspense>
  );
}
