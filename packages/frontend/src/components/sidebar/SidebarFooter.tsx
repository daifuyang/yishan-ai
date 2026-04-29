"use client";

import React from "react";
import { Settings } from "lucide-react";

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

export function SidebarFooter() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton>
              <Settings data-icon="inline-start" />
              <span>设置</span>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">设置</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}