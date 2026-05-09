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
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scrollbar-thin scroll-smooth relative flex flex-col"
    >
      {hasMessages ? (
        <>
          {/* 消息区域 —— flex-1 确保即使消息很少也能撑开空间 */}
          <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-4">
            {messages}
          </div>

          {/* 底部输入框 —— sticky 吸底，滚动条延伸到此处 */}
          <div className="sticky bottom-0 z-20">
            {showScrollButton && (
              <div className="flex justify-center pb-2 relative z-30">
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
            <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 relative z-20">
              <div className="max-w-3xl mx-auto p-4">{input}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8 animate-fade-in-up">
          <EmptyState />
          <div className="w-full max-w-3xl">{input}</div>
        </div>
      )}
    </div>
  );
}
