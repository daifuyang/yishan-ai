'use client';

import { ChatInput } from './chat-input';
import { type ChatMode } from '@/lib/constants';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "上午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

interface EmptyStateProps {
  onSend: (content: string, model: string, mode: ChatMode) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  defaultModel?: string;
  initialContent?: string;
}

export function EmptyState({ onSend, onStop, isStreaming, disabled, defaultModel, initialContent }: EmptyStateProps) {
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
          initialContent={initialContent}
        />
      </div>
    </div>
  );
}
