"use client";

import React from "react";
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarRail,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen className="">
      {/* 侧边栏 */}
      <Sidebar collapsible="offcanvas" className="border-r">
        <AppSidebar />
      </Sidebar>
      {/* 内容区域 */}
      <SidebarInset className="">
        {children}
      </SidebarInset>
      <SidebarRail />
    </SidebarProvider>
  );
}