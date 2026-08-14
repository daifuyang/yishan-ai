'use client';

import {
  FolderPlus,
  MessageCirclePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspaceList } from '@/components/sidebar/WorkspaceList';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { apiUrl } from '@/lib/api-base';
import { cn } from '@/lib/utils';

function LogoIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
    >
      <title>App Logo</title>
      <path
        d="M12 2L2 9L12 16L22 9L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 15L12 22L22 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 9L12 2L22 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function SidebarIconButton({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-center w-10 h-10 rounded-[10px] transition-colors cursor-pointer text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
      <Icon className="w-5 h-5" />
    </div>
  );

  const wrapped = href ? (
    <Link href={href}>{content}</Link>
  ) : (
    <button type="button" onClick={onClick}>
      {content}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{wrapped}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function CollapsedContent() {
  const { toggleSidebar } = useSidebar();
  const router = useRouter();

  const handleNewChat = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <div className="flex flex-col items-center h-full py-3">
      {/* Brand / Expand — shared slot */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleSidebar}
            className="group/brand relative flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-sidebar-accent focus-visible:bg-sidebar-accent transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <LogoIcon
              size={22}
              className="absolute inset-0 m-auto transition-all duration-150 opacity-100 scale-100 group-hover/brand:opacity-0 group-hover/brand:scale-[0.92] group-focus-visible/brand:opacity-0 group-focus-visible/brand:scale-[0.92]"
            />
            <PanelLeftOpen className="absolute inset-0 m-auto w-5 h-5 text-sidebar-foreground/70 transition-all duration-150 opacity-0 scale-[0.92] group-hover/brand:opacity-100 group-hover/brand:scale-100 group-focus-visible/brand:opacity-100 group-focus-visible/brand:scale-100" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          展开侧边栏
        </TooltipContent>
      </Tooltip>

      {/* Primary actions group */}
      <div className="flex flex-col items-center gap-2 mt-4">
        <SidebarIconButton icon={MessageCirclePlus} label="新建对话" onClick={handleNewChat} />
        <SidebarIconButton icon={Search} label="搜索" onClick={() => {}} />
      </div>

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1" />

      {/* Footer actions */}
      <div className="flex flex-col items-center gap-2">
        <SidebarIconButton icon={Settings} label="设置" href="/settings" />
      </div>
    </div>
  );
}

function ExpandedContent() {
  const router = useRouter();
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNewChat = useCallback(() => {
    const url = new URL(window.location.href);
    const hasSessionId = url.searchParams.has('sessionId');

    if (!hasSessionId && window.location.pathname === '/') {
      if (isMobile) setOpenMobile(false);
    } else {
      if (isMobile) setOpenMobile(false);
      router.push('/');
    }
  }, [router, isMobile, setOpenMobile]);

  const handleCreateWorkspace = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/workspace/pick-directory'), { method: 'POST' });
      if (res.ok && res.status !== 204) {
        const data = await res.json();
        if (data.path) {
          router.push('/');
        }
      }
    } catch {
      // user cancelled
    }
  }, [router]);

  return (
    <div className="flex flex-col h-full">
      {/* Brand + collapse */}
      <div className="flex items-center justify-between h-[56px] px-4 shrink-0">
        <div className="flex items-center gap-2">
          <LogoIcon size={20} />
          <span className="text-sm font-semibold text-sidebar-foreground">Yishan AI</span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New conversation */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={handleNewChat}
          className={cn(
            'flex items-center gap-2 w-full h-[40px] px-3 rounded-[10px]',
            'text-sm font-medium text-sidebar-foreground/80',
            'border border-sidebar-border/60',
            'hover:bg-sidebar-accent hover:text-sidebar-foreground',
            'transition-colors duration-150'
          )}
        >
          <MessageCirclePlus className="w-4 h-4" />
          <span>新建对话</span>
        </button>
      </div>

      {/* Workspace section header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        {searchMode ? (
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索工作区或会话..."
              ref={(el) => el?.focus()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchMode(false);
                  setSearchQuery('');
                }
              }}
              className="flex-1 text-xs bg-transparent border-0 outline-none text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
            <button
              type="button"
              onClick={() => {
                setSearchMode(false);
                setSearchQuery('');
              }}
              className="text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground"
            >
              &times;
            </button>
          </div>
        ) : (
          <>
            <span className="text-xs font-medium text-sidebar-foreground/60">工作区</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSearchMode(true)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCreateWorkspace}
                className="flex items-center justify-center w-7 h-7 rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        <WorkspaceList searchQuery={searchQuery} />
      </div>

      {/* Footer */}
      <div className="border-t shrink-0">
        <div className="flex flex-col px-3 py-2">
          <Link
            href="/settings"
            className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors p-2"
          >
            <Settings className="h-4 w-4" />
            <span>设置</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div className="h-full overflow-hidden">
      {isCollapsed ? (
        <div className="animate-in fade-in duration-150">
          <CollapsedContent />
        </div>
      ) : (
        <div className="animate-in fade-in duration-150">
          <ExpandedContent />
        </div>
      )}
    </div>
  );
}
