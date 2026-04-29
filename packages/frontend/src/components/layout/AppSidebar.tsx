"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCirclePlus, Settings, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session-store";
import { SessionList } from "@/components/sidebar/SessionList";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleNewChat = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-3 px-3 py-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <LogoIcon />
          <span className={isCollapsed ? "" : "text-sm font-semibold"}>Yishan AI</span>
          <div
            onClick={toggleSidebar}
            className="ml-auto p-2 hover:bg-black/10 rounded-md cursor-pointer transition-colors"
          >
            <PanelLeft className="h-4 w-4 text-foreground" />
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="w-full justify-start gap-2 h-9 px-3 text-sm font-medium shadow-none"
            >
              <MessageCirclePlus className="h-4 w-4" />
              <span className="group-data-[state=collapsed]:hidden">新建对话</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">新建对话</TooltipContent>
        </Tooltip>
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

      <div className="mt-auto border-t shrink-0">
        <div className="px-3 py-2 group-data-[state=collapsed]:hidden">
          <Link
            href="/history"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-black/10 rounded-md transition-colors p-2"
          >
            <History className="w-4 h-4" />
            <span>查看历史</span>
          </Link>
        </div>

        <div className="group-data-[state=collapsed]:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-black/10 rounded-md transition-colors p-2 mx-3 my-2">
                <Settings className="h-4 w-4" />
                <span>设置</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}