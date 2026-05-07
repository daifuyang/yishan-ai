'use client';

import React, { useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Copy, Check, Bot, RotateCcw } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ToolItem, groupToolCalls, type ToolCall } from '@/components/mcp/tool-call-block';

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
  className?: string;
}

function contentBlocksToToolCalls(blocks: ContentBlock[]): ToolCall[] {
  return blocks
    .filter((b): b is ContentBlock & { name: string } => b.type === 'tool_use' && !!b.name)
    .map((block) => ({
      id: block.id || crypto.randomUUID(),
      name: block.name,
      input: block.input || {},
      output: block.result,
      error: block.error,
      status: block.error ? 'error' as const : block.result ? 'completed' as const : 'running' as const,
    }));
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
  const textContent = typeof message.content === 'string'
    ? message.content
    : message.content.filter(c => c.type === 'text').map(c => c.text).join('');

  const toolUseBlocks = typeof message.content === 'string'
    ? []
    : message.content.filter(c => c.type === 'tool_use');

  const toolCalls = contentBlocksToToolCalls(toolUseBlocks);

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {toolCalls.map((toolCall) => (
        <ToolItem key={toolCall.id} toolCall={toolCall} />
      ))}

      {textContent && (
        <div className="msg-actions-wrapper">
<div className="bg-card text-foreground rounded max-w-full">
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
      <div className="px-3 py-0.5 sm:py-1 rounded bg-primary text-primary-foreground shadow-sm w-fit">
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
    <div className="bg-card text-foreground rounded max-w-full">
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

export function MessageList({ messages, isStreaming, streamingContent, onRollback, className }: MessageListProps) {
  const { copiedId, handleCopy } = useCopyToClipboard();

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const hasToolUseBlocks = lastAssistantMsg &&
    typeof lastAssistantMsg.content !== 'string' &&
    lastAssistantMsg.content.some(c => c.type === 'tool_use');

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="w-full space-y-5">
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
    </div>
  );
}