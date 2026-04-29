"use client";

import React from "react";
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { PanelRight } from "lucide-react";

function FloatingExpandIcon() {
  const { state, toggleSidebar } = useSidebar();
  if (state !== "collapsed") return null;

  return (
    <div
      onClick={toggleSidebar}
      className="fixed left-3 top-[18px] z-50 cursor-pointer p-2 hover:bg-black/10 rounded-md transition-colors"
    >
      <PanelRight className="h-4 w-4 text-foreground" />
    </div>
  );
}

export function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="offcanvas" className="border-r">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        {children}
      </SidebarInset>
      <SidebarRail />
      <FloatingExpandIcon />
    </SidebarProvider>
  );
}