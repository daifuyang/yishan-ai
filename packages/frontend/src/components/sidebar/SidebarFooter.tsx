"use client";

import React, { useState } from "react";
import { Settings, Bot } from "lucide-react";

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
import { MCPDialog } from "@/components/mcp/mcp-dialog";

export function SidebarFooter() {
  const [mcpOpen, setMcpOpen] = useState(false);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton onClick={() => setMcpOpen(true)}>
                <Bot className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">MCP</span>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right">MCP & Skills</TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton>
                <Settings className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">设置</span>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>
      <MCPDialog open={mcpOpen} onOpenChange={setMcpOpen} />
    </>
  );
}
