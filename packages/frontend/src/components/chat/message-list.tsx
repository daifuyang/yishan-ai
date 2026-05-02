'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Copy, Check, Bot, RotateCcw, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ToolCallBlock, type ToolCall } from '@/components/mcp/tool-call-block';

const markdownComponents: Components = {
  table: ({ children }) => <table>{children}</table>,
};

interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  type?: 'user' | 'assistant' | 'final';
  content: string | ContentBlock[];
  thinking?: string;
  toolCalls?: ToolCall[];
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
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

function ToolUseCard({ block }: { block: ContentBlock }) {
  const [expanded, setExpanded] = useState(false);

  if (block.type !== 'tool_use') return null;

  return (
    <div className="border rounded-lg p-3 my-2 bg-muted/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm font-medium"><Wrench className="h-3 w-3" /> {block.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? '收起' : '展开'}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">输入：</span>
            <pre className="mt-1 p-2 bg-background rounded overflow-auto max-h-32">
              {JSON.stringify(block.input || {}, null, 2)}
            </pre>
          </div>
          {block.result !== undefined && (
            <div>
              <span className="text-muted-foreground">输出：</span>
              <pre className={cn(
                "mt-1 p-2 bg-background rounded overflow-auto max-h-48",
                block.error && "text-destructive"
              )}>
                {block.error || block.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
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
  const textContent = typeof message.content === 'string'
    ? message.content
    : message.content.filter(c => c.type === 'text').map(c => c.text).join('');

  const toolUseBlocks = typeof message.content === 'string'
    ? []
    : message.content.filter(c => c.type === 'tool_use');

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {toolUseBlocks.length > 0 && (
        <div className="text-sm text-muted-foreground">
          使用了 {toolUseBlocks.length} 个工具
        </div>
      )}

      {toolUseBlocks.map((block, idx) => (
        <ToolUseCard key={block.id || idx} block={block} />
      ))}

      {textContent && (
        <div className="msg-actions-wrapper">
          <div className="bg-card text-foreground rounded">
            <div className="prose dark:prose-invert max-w-none text-[15px]">
              <ReactMarkdown
                components={markdownComponents}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {textContent}
              </ReactMarkdown>
            </div>
          </div>
          <div className="msg-action-btn">
            <CopyButton content={textContent} id={message.id} copiedId={copiedId} onCopy={onCopy} />
          </div>
        </div>
      )}
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
  const textContent = typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content);

  return (
    <div className="msg-actions-wrapper align-end">
      <div className="px-3 py-1.5 rounded bg-primary text-primary-foreground shadow-sm w-fit">
        <div className="prose prose-invert max-w-none text-[15px] prose-p:my-0 prose-li:my-0">
          <ReactMarkdown>{textContent}</ReactMarkdown>
        </div>
      </div>
      <div className="msg-action-btn flex gap-1 mt-1">
        {onRollback && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground gap-1 [&_svg]:size-3"
            onClick={() => onRollback(message.id, textContent)}
          >
            <RotateCcw />
            回退
          </Button>
        )}
        <CopyButton content={textContent} id={message.id} copiedId={copiedId} onCopy={onCopy} />
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
    <div className="bg-card h-10 mt-0 flex items-center justify-start">
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

export function MessageList({ messages, isStreaming, streamingContent, onRollback }: MessageListProps) {
  const { containerRef, handleScroll, isNearBottom } = useAutoScroll(isStreaming);
  const { copiedId, handleCopy } = useCopyToClipboard();

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const hasToolUseBlocks = lastAssistantMsg &&
    typeof lastAssistantMsg.content !== 'string' &&
    lastAssistantMsg.content.some(c => c.type === 'tool_use');

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

        {isStreaming && !hasToolUseBlocks && (
          <div className="flex gap-4 justify-start animate-fade-in-up">
            <BotAvatar />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              {streamingContent ? (
                <StreamingBubble content={streamingContent} />
              ) : (
                <StreamingIndicator />
              )}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}