'use client';

import { Bot, Check, Copy, RefreshCw, RotateCcw } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { ContextToolGroup, groupToolCalls, ToolItem } from '@/components/mcp/tool-call-block';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ContentBlock, Message, ToolCall, ToolCallGroup } from '@/types';

interface MessageListProps {
  messages: Message[];
  onRollback?: (messageId: string, content: string) => void;
  onRetry?: (messageId: string, model: string, mode: 'plan' | 'build') => void;
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
      status: block.error
        ? ('error' as const)
        : block.result
          ? ('completed' as const)
          : ('running' as const),
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

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';

  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join('');
  }

  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    return extractTextFromReactNode(children);
  }

  return '';
}

function CopyButton({
  content,
  id,
  copiedId,
  onCopy,
}: {
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const isPending = message.status === 'pending';

  const textContent =
    typeof message.content === 'string'
      ? message.content
      : message.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('');

  const toolUseBlocks =
    typeof message.content === 'string' ? [] : message.content.filter((c) => c.type === 'tool_use');

  const toolCalls = contentBlocksToToolCalls(toolUseBlocks);
  const groups = groupToolCalls(toolCalls);

  const handleCodeCopy = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const assistantMarkdownComponents: Components = {
    table: ({ children }) => (
      <div className="chat-table-scroll w-full max-w-full overflow-x-auto">
        <table className="!w-max min-w-max">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="whitespace-nowrap">{children}</th>,
    td: ({ children }) => <td className="whitespace-nowrap">{children}</td>,
    pre: ({ children }) => {
      const codeText = extractTextFromReactNode(children);
      return (
        <div className="relative group">
          <pre className="!my-0">{children}</pre>
          <button
            type="button"
            onClick={() => handleCodeCopy(codeText)}
            className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            title="复制代码"
          >
            {copiedCode === codeText ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      );
    },
  };

  const renderGroup = (group: ToolCallGroup) => {
    if (group.type === 'context') {
      return <ContextToolGroup key={`context-${group.tools[0]?.id}`} toolCalls={group.tools} />;
    }
    return group.tools.map((tool) => <ToolItem key={tool.id} toolCall={tool} />);
  };

  if (isPending && !textContent) {
    return (
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <StreamingIndicator />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {groups.length > 0 && <div className="flex flex-col gap-2">{groups.map(renderGroup)}</div>}

      {textContent && (
        <div className="msg-actions-wrapper w-full max-w-full overflow-hidden">
          <div className="prose dark:prose-invert max-w-none text-[15px] w-full min-w-0">
            <ReactMarkdown
              components={assistantMarkdownComponents}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {textContent}
            </ReactMarkdown>
            {isPending && <span className="inline-block ml-1 blinking-cursor">│</span>}
          </div>
          {!isPending && (
            <div className="msg-action-btn">
              <CopyButton
                content={textContent}
                id={message.id}
                copiedId={copiedId}
                onCopy={onCopy}
              />
            </div>
          )}
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
  onRetry,
}: {
  message: Message;
  copiedId: string | null;
  onCopy: (content: string, id: string) => void;
  onRollback?: (messageId: string, content: string) => void;
  onRetry?: (messageId: string, model: string, mode: 'plan' | 'build') => void;
}) {
  const textContent =
    typeof message.content === 'string'
      ? message.content
      : message.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('') || JSON.stringify(message.content);

  const isFailed = message.status === 'failed';
  const isPending = message.status === 'pending';

  return (
    <div className="msg-actions-wrapper align-end">
      <div
        className={cn(
          'px-3 py-2 rounded shadow-sm',
          isFailed ? 'bg-red-500/20 border border-red-500/50' : 'bg-primary text-primary-foreground'
        )}
      >
        <div className="prose prose-sm prose-invert max-w-none text-[15px] [&>p]:my-0 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          <ReactMarkdown>{textContent}</ReactMarkdown>
        </div>
        {isFailed && message.error && (
          <div className="text-xs text-red-400 mt-1">{message.error}</div>
        )}
      </div>
      <div className="msg-action-btn flex gap-1 mt-1">
        {isFailed && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-red-500 hover:text-red-400 gap-1 [&_svg]:size-3"
            onClick={() => onRetry(message.id, message.model || 'MiniMax-M2.7', 'build')}
          >
            <RefreshCw className="h-3 w-3" />
            重试
          </Button>
        )}
        {onRollback && !isFailed && !isPending && (
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
    <Avatar className="h-10 w-10 shrink-0 mt-0 hidden sm:flex">
      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/10">
        <Bot className="h-5 w-5" />
      </AvatarFallback>
    </Avatar>
  );
}

function StreamingIndicator() {
  return (
    <div className="h-8 mt-0 flex items-center justify-start">
      <div className="flex gap-1.5">
        <Skeleton
          className="h-2 w-2 rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <Skeleton
          className="h-2 w-2 rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <Skeleton
          className="h-2 w-2 rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}

export function MessageList({ messages, onRollback, onRetry, className }: MessageListProps) {
  const { copiedId, handleCopy } = useCopyToClipboard();

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="w-full space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className="flex w-full items-start gap-2 sm:gap-4 animate-fade-in-up">
            {msg.role === 'assistant' ? (
              <>
                <BotAvatar />
                <div className="w-full min-w-0 mr-auto">
                  <AssistantBubble message={msg} copiedId={copiedId} onCopy={handleCopy} />
                </div>
              </>
            ) : (
              <>
                <div className="w-full min-w-0 ml-auto sm:w-auto sm:max-w-[85%]">
                  <UserBubble
                    message={msg}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onRollback={onRollback}
                    onRetry={onRetry}
                  />
                </div>
                <div className="w-10 shrink-0 hidden sm:block" aria-hidden />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
