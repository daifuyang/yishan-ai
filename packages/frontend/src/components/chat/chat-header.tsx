'use client';

import React from 'react';
import { Menu, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

interface ChatHeaderProps {
  title: string;
  onDelete?: () => void;
  onTitleClick?: () => void;
}

export function ChatHeader({ title, onDelete, onTitleClick }: ChatHeaderProps) {
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
            <h1
              className="text-sm font-medium truncate cursor-pointer hover:text-foreground/80"
              onClick={onTitleClick}
            >
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

        <div className="shrink-0 flex items-center gap-1">
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
