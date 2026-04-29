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
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <p className="text-2xl font-medium">{getGreeting()}</p>
      <div className="w-full max-w-2xl px-4">
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