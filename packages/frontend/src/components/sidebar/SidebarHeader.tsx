"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BotMessageSquare, Plus, Search } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarHeader() {
  const router = useRouter();

  const handleNewChat = () => {
    router.push('/');
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild isActive>
              <Link href="/">
                <BotMessageSquare data-icon="inline-start" />
                <span>Yishan AI</span>
              </Link>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">Yishan AI</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton onClick={handleNewChat}>
              <Plus data-icon="inline-start" />
              <span>新建对话</span>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">新建对话</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton>
              <Search data-icon="inline-start" />
              <span>搜索</span>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">搜索会话</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}