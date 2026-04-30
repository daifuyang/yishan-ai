'use client';

import React from 'react';
import { ChatInput } from './chat-input';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "上午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

interface EmptyStateProps {
  onSend: (content: string, model: string, mode: 'plan' | 'build') => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  defaultModel?: string;
}

export function EmptyState({ onSend, onStop, isStreaming, disabled, defaultModel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in-up">
      <div className="text-center space-y-1">
        <p className="text-xl font-semibold tracking-tight">{getGreeting()}</p>
        <p className="text-sm text-muted-foreground tracking-wide">Yishan AI 助手</p>
      </div>
      <div className="w-full max-w-xl px-4 mt-2">
        <ChatInput
          onSend={onSend}
          onStop={onStop}
          isStreaming={isStreaming}
          disabled={disabled}
          defaultModel={defaultModel}
        />
      </div>
    </div>
  );
}