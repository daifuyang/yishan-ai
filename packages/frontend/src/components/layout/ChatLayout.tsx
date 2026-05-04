"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  const { state, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();
  const [visible, setVisible] = useState(false);

  const handleOpenMobile = useCallback(() => {
    setOpenMobile(true);
  }, [setOpenMobile]);

  useEffect(() => {
    if (isMobile) {
      setVisible(!openMobile);
    } else if (state === "collapsed") {
      const timer = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [state, isMobile, openMobile]);

  if (!visible) return null;

  if (isMobile) {
    return (
      <div
        onClick={handleOpenMobile}
        className="fixed left-3 top-[18px] z-50 cursor-pointer p-2 bg-background border rounded-md shadow-md hover:bg-accent"
      >
        <PanelRight className="h-4 w-4 text-foreground" />
      </div>
    );
  }

  return (
    <div
      onClick={toggleSidebar}
      className="fixed left-3 top-[18px] z-50 cursor-pointer p-2 hover:bg-black/10 rounded-md"
    >
      <PanelRight className="h-4 w-4 text-foreground" />
    </div>
  );
}

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
      <FloatingExpandIcon />
    </SidebarProvider>
  );
}