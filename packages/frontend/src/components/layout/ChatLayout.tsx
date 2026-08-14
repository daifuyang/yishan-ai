'use client';

import type React from 'react';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';

export function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="">
      <Sidebar collapsible="icon" className="border-r">
        <AppSidebar />
      </Sidebar>
      <SidebarInset
        style={{
          padding:
            'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        }}
      >
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
