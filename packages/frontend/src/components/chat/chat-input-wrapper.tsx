'use client';

import React from 'react';
import { ChatInput } from './chat-input';
import type { ChatMode } from '@/lib/constants';

interface ChatInputWrapperProps {
  onSend: (content: string, model: string, mode: ChatMode) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  defaultModel?: string;
  noBorder?: boolean;
  initialContent?: string;
  showPadding?: boolean;
}

export function ChatInputWrapper({
  onSend,
  onStop,
  isStreaming,
  disabled,
  defaultModel,
  noBorder,
  initialContent,
  showPadding = true,
}: ChatInputWrapperProps) {
  return (
    <div className={`w-full ${showPadding ? 'px-4 sm:px-0' : ''}`}>
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={disabled}
        defaultModel={defaultModel}
        noBorder={noBorder}
        initialContent={initialContent}
      />
    </div>
  );
}