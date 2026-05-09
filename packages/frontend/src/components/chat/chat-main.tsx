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
  input: React.ReactNode;
}

export function ChatMain({
  hasMessages,
  shouldShowLoading,
  containerRef,
  showScrollButton,
  scrollToBottom,
  messages,
  input,
}: ChatMainProps) {
  if (shouldShowLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-thin scroll-smooth relative min-h-0"
      >
        <div className={hasMessages ? 'flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-4' : 'hidden'}>
          {messages}
        </div>
        <div className={hasMessages ? 'hidden' : 'flex flex-col items-center justify-center h-full px-4 py-8'}>
          <EmptyState />
        </div>
      </div>
      <div className="shrink-0">
        {showScrollButton && (
          <div className="flex justify-center pb-2">
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
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="max-w-3xl mx-auto p-4">{input}</div>
        </div>
      </div>
    </div>
  );
}
