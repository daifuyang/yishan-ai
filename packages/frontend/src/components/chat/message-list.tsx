'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Copy, Check, Bot, RotateCcw } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ToolCallBlock, ToolCallBadgeList, type ToolCall } from '@/components/mcp/tool-call-block';

const markdownComponents: Components = {
  table: ({ children }) => <table>{children}</table>,
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  activeToolCalls?: ToolCall[];
  onRollback?: (messageId: string, content: string) => void;
}

function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return { copiedId, handleCopy };
}

function useAutoScroll(isStreaming: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const handleScroll = useCallback(() => {
    const container = containerRef.current?.querySelector('[data-scroll="true"]');
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceFromBottom < 100);
  }, []);

  useEffect(() => {
    if (isStreaming && isNearBottom) {
      const container = containerRef.current?.querySelector('[data-scroll="true"]');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [isStreaming, isNearBottom]);

  return { containerRef, handleScroll, isNearBottom };
}

function CopyButton({ content, id, copiedId, onCopy }: {
  content: string;
  id: string;
  copiedId: string | null;
  onCopy: (content: string, id: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground gap-1 [&_svg]:size-3"
      onClick={() => onCopy(content, id)}
    >
      {copiedId === id ? (
        <>
          <Check />
          已复制
        </>
      ) : (
        <>
          <Copy />
          复制
        </>
      )}
    </Button>
  );
}

function AssistantBubble({
  message,
  copiedId,
  onCopy,
}: {
  message: Message;
  copiedId: string | null;
  onCopy: (content: string, id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {message.toolCalls && message.toolCalls.length > 0 && (
        <ToolCallBlock toolCalls={message.toolCalls} variant="compact" />
      )}
      <div className="msg-actions-wrapper">
        <div className="bg-card text-foreground rounded">
          <div className="prose dark:prose-invert max-w-none text-[15px]">
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="msg-action-btn">
          <CopyButton content={message.content} id={message.id} copiedId={copiedId} onCopy={onCopy} />
        </div>
      </div>
    </div>
  );
}

function UserBubble({
  message,
  copiedId,
  onCopy,
  onRollback,
}: {
  message: Message;
  copiedId: string | null;
  onCopy: (content: string, id: string) => void;
  onRollback?: (messageId: string, content: string) => void;
}) {
  return (
    <div className="msg-actions-wrapper">
      <div className="px-5 py-2 rounded bg-primary text-primary-foreground shadow-sm w-fit">
        <p className="text-[15px] leading-relaxed">{message.content}</p>
      </div>
      <div className="msg-action-btn">
        <div className="flex gap-1 mt-1">
          {onRollback && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground gap-1 [&_svg]:size-3"
              onClick={() => onRollback(message.id, message.content)}
            >
              <RotateCcw />
              回退
            </Button>
          )}
          <CopyButton content={message.content} id={message.id} copiedId={copiedId} onCopy={onCopy} />
        </div>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <Avatar className="h-10 w-10 shrink-0 mt-0">
      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/10">
        <Bot className="h-5 w-5" />
      </AvatarFallback>
    </Avatar>
  );
}

function StreamingIndicator() {
  return (
    <div className="bg-card h-10 mt-0 flex items-center justify-center">
      <div className="flex gap-1.5">
        <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="bg-card text-foreground rounded">
      <div className="prose dark:prose-invert max-w-none text-[15px]">
        <ReactMarkdown
          components={markdownComponents}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {content}
        </ReactMarkdown>
        <span className="inline-block ml-1 animate-pulse">▌</span>
      </div>
    </div>
  );
}

function StreamingToolIndicator({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (toolCalls.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mt-2">
      <ToolCallBadgeList toolCalls={toolCalls} />
    </div>
  );
}

export function MessageList({ messages, isStreaming, streamingContent, activeToolCalls = [], onRollback }: MessageListProps) {
  const { containerRef, handleScroll, isNearBottom } = useAutoScroll(isStreaming);
  const { copiedId, handleCopy } = useCopyToClipboard();

  return (
    <ScrollArea className="flex-1 px-4 py-6" ref={containerRef} onScroll={handleScroll}>
      <div className="max-w-3xl mx-auto space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-4 animate-fade-in-up',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && <BotAvatar />}
            {msg.role === 'user' ? (
              <UserBubble message={msg} copiedId={copiedId} onCopy={handleCopy} onRollback={onRollback} />
            ) : (
              <AssistantBubble message={msg} copiedId={copiedId} onCopy={handleCopy} />
            )}
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="flex gap-4 justify-start animate-fade-in-up">
            <BotAvatar />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <StreamingBubble content={streamingContent} />
              <StreamingToolIndicator toolCalls={activeToolCalls} />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-4 justify-start animate-fade-in-up">
            <BotAvatar />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <StreamingIndicator />
              <StreamingToolIndicator toolCalls={activeToolCalls} />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
