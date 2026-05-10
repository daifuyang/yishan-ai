'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { EmptyState } from './empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ChatMainProps {
  hasMessages: boolean;
  shouldShowLoading: boolean;
  containerRef: React.RefObject<HTMLDivElement | null> | ((node: HTMLDivElement | null) => void);
  showScrollButton: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  messages: React.ReactNode;
}

export function ChatMain({
  hasMessages,
  shouldShowLoading,
  containerRef,
  showScrollButton,
  scrollToBottom,
  messages,
}: ChatMainProps) {
  if (shouldShowLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <div
        ref={containerRef}
        className="flex flex-1 overflow-y-auto scrollbar-thin scroll-smooth min-h-0"
      >
        <div className={hasMessages ? 'flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-4' : 'hidden'}>
          {messages}
        </div>
        {!hasMessages && (
          <>
            <div className="flex md:hidden flex-col items-center justify-start px-4 pb-8 pt-[50%] w-full">
              <EmptyState />
            </div>
            <div className="hidden md:flex md:flex-col md:flex-1 md:items-center md:justify-center md:px-6 md:pt-0 md:max-w-3xl md:mx-auto">
              <EmptyState />
            </div>
          </>
        )}
      </div>

      {showScrollButton && (
        <div className="fixed left-0 right-0 z-40 flex justify-center md:hidden" style={{ bottom: '160px' }}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scrollToBottom('smooth')}
            className="h-9 w-9 rounded-full bg-background/95 backdrop-blur shadow-md border-muted-foreground/20"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
