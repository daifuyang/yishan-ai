'use client';

import {
  ChevronRight,
  FolderClosed,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useState } from 'react';
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
import { DEFAULT_SESSION_LIMIT } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { type Session, useSessionStore } from '@/stores/session-store';

function SessionItem({ session }: { session: Session }) {
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

  const handleOpenEdit = useCallback(() => {
    setNewTitle(session.title);
    setEditOpen(true);
    setMenuOpen(false);
  }, [session.title]);

  const handleOpenDelete = useCallback(() => {
    setDeleteOpen(true);
    setMenuOpen(false);
  }, []);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover state needed for dropdown menu visibility */}
      <div
        className={cn(
          'session-item flex items-center gap-1 px-3 py-2 rounded-md transition-all',
          !isActive &&
            'text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-foreground',
          isActive && 'bg-black text-white font-medium'
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Link
          href={`/?sessionId=${session.id}`}
          className="flex-1 truncate text-sm"
          onClick={() => setOpenMobile(false)}
        >
          {session.title || '新对话'}
        </Link>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              style={{ opacity: hovered || menuOpen ? 1 : 0 }}
              className={cn(
                'h-6 w-6 transition-opacity bg-transparent',
                isActive
                  ? 'text-white hover:bg-transparent hover:text-white'
                  : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleOpenEdit();
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
                handleOpenDelete();
              }}
              className="text-red-600 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
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

function SessionGroup({ group }: { group: { key: string; label: string; sessions: Session[] } }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      {group.label && (
        <button
          type="button"
          className="group flex items-center gap-1 w-full px-1 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          <span className="relative h-4 w-4 flex items-center justify-center shrink-0">
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 absolute opacity-0 group-hover:opacity-100',
                expanded && 'rotate-90'
              )}
            />
            <span className="group-hover:opacity-0 transition-opacity duration-150">
              {expanded ? (
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FolderClosed className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>
          </span>
          <span className="text-xs text-muted-foreground font-medium truncate">{group.label}</span>
          <span className="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">
            {group.sessions.length}
          </span>
        </button>
      )}
      {expanded && (
        <div className="flex flex-col gap-1 animate-in fade-in duration-150">
          {group.sessions.map((session) => (
            <SessionItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionListInner() {
  const { sessions, fetchSessions } = useSessionStore();

  React.useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const displaySessions = sessions.slice(0, DEFAULT_SESSION_LIMIT);

  const grouped = React.useMemo(() => {
    const groups: { key: string; label: string; sessions: Session[] }[] = [];
    const map = new Map<string, Session[]>();

    for (const s of displaySessions) {
      const key = s.cwd || '__default__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    for (const [key, items] of map) {
      const label = key === '__default__' ? '' : key.split('/').filter(Boolean).pop() || key;
      groups.push({ key, label, sessions: items });
    }

    return groups;
  }, [displaySessions]);

  const showGroups =
    grouped.length > 1 || (grouped.length === 1 && grouped[0].key !== '__default__');

  return (
    <div className="flex flex-col px-3 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {displaySessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <p>暂无会话记录</p>
          </div>
        ) : showGroups ? (
          <div className="flex flex-col gap-2">
            {grouped.map((group) => (
              <SessionGroup key={group.key} group={group} />
            ))}
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
