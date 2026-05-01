'use client';

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Settings, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    id: "mcp",
    label: "MCP",
    icon: Bot,
    href: "/settings/mcp",
  },
  {
    id: "skills",
    label: "Skills",
    icon: Sparkles,
    href: "/settings/skills",
  },
  {
    id: "general",
    label: "通用设置",
    icon: Settings,
    href: "/settings/general",
  },
];

function LogoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M12 2L2 9L12 16L22 9L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 15L12 22L22 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === "/settings/mcp") return "MCP 服务器";
    if (pathname === "/settings/skills") return "Skills";
    if (pathname === "/settings/general") return "通用设置";
    return "设置";
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Header */}
      <header className="h-14 px-4 flex items-center gap-3 border-b bg-background shrink-0">
        <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          <LogoIcon />
          <span className="font-medium">Yishan AI</span>
        </Link>
        <span className="text-muted-foreground">—</span>
        <span className="text-foreground font-medium">{getPageTitle()}</span>
      </header>

      {/* Main Content: Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[200px] border-r bg-muted/30 flex flex-col shrink-0">
          <nav className="flex-1 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors mb-1",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="h-3 w-3" />}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-muted/10">
          {children}
        </main>
      </div>
    </div>
  );
}
