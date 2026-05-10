'use client';

import { Bot, ChevronRight, FileText, Settings, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { ChatLayout } from '@/components/layout/ChatLayout';
import { cn } from '@/lib/utils';

const navItems = [
  {
    id: 'mcp',
    label: 'MCP 服务器',
    icon: Bot,
    href: '/settings/mcp',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: Sparkles,
    href: '/settings/skills',
  },
  {
    id: 'security',
    label: '安全设置',
    icon: Shield,
    href: '/settings/security',
  },
  {
    id: 'logs',
    label: '日志',
    icon: FileText,
    href: '/settings/logs',
  },
  {
    id: 'general',
    label: '通用设置',
    icon: Settings,
    href: '/settings/general',
  },
];

function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors mb-1',
              isActive
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {isActive && <ChevronRight className="h-3 w-3" />}
          </Link>
        );
      })}
    </nav>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatLayout>
      <div className="flex flex-1 h-full">
        <aside className="w-[200px] border-r bg-muted/30 flex flex-col shrink-0">
          <SettingsNav />
        </aside>
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </ChatLayout>
  );
}
