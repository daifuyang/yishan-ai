'use client';

import { ChatInput } from './chat-input';

interface ChatInputWrapperProps {
  onSend: (content: string, model: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  defaultModel?: string;
  noBorder?: boolean;
  initialContent?: string;
  showPadding?: boolean;
  cwd?: string;
  onCwdChange?: (cwd: string) => void;
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
  cwd,
  onCwdChange,
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
        cwd={cwd}
        onCwdChange={onCwdChange}
      />
    </div>
  );
}
