"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCirclePlus, Settings, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SessionList } from "@/components/sidebar/SessionList";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { PanelLeft } from "lucide-react";

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
        stroke="#171717"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 15L12 22L22 15"
        stroke="#171717"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 9L12 2L22 9"
        stroke="#171717"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function AppSidebar() {
  const router = useRouter();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleNewChat = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-3 px-3 py-3">
        <div className="flex items-center gap-2 py-1.5 px-2">
          <LogoIcon />
          <span className={isCollapsed ? "" : "text-sm font-semibold"}>Yishan AI</span>
          {isMobile && (
            <div
              onClick={toggleSidebar}
              className="ml-auto p-2 hover:bg-black/10 rounded-md cursor-pointer transition-colors"
            >
              <PanelLeft className="h-4 w-4 text-foreground" />
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="w-full justify-start gap-2 h-9 px-3 text-sm font-medium shadow-none"
        >
          <MessageCirclePlus className="h-4 w-4" />
          <span className="group-data-[state=collapsed]:hidden">新建对话</span>
        </Button>
      </div>

      <Separator className="mb-2" />

      <div className="px-3 py-2">
        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground group-data-[state=collapsed]:hidden">
          <History className="w-4 h-4" />
          <span>历史会话</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <SessionList />
      </div>

      <div className="mt-auto border-t shrink-0 group-data-[state=collapsed]:hidden">
        <div className="flex flex-col px-3 py-2">
          <Link
            href="/history"
            className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-black/10 rounded-md transition-colors p-2"
          >
            <History className="w-4 h-4" />
            <span>查看历史</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-black/10 rounded-md transition-colors p-2"
          >
            <Settings className="h-4 w-4" />
            <span>设置</span>
          </Link>
        </div>
      </div>
    </div>
  );
}