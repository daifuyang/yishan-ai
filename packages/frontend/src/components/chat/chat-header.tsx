'use client';

import React from 'react';
import { Menu, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

interface ChatHeaderProps {
  title: string;
}

export function ChatHeader({ title }: ChatHeaderProps) {
  const { toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();

  const handleToggle = () => {
    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      toggleSidebar();
    }
  };

  return (
    <div className="shrink-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      <div className="flex items-center h-14 pl-4 pr-4 sm:pl-6 sm:pr-6">
        <div className="shrink-0 -ms-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 ps-0"
            onClick={handleToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className='flex-1 flex justify-start min-w-0'>
          <div className="w-full mx-auto max-w-3xl">
          <div className="flex items-center gap-2 group min-w-0">
            <h1 className="text-sm font-medium truncate">
              {title || '新对话'}
            </h1>
          <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </div>

        <div className="shrink-0 h-9 w-9" />
      </div>
    </div>
  );
}
