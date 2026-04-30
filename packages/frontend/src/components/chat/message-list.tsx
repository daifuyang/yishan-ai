'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Copy, Check, Bot, User } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ToolCallBlock, type ToolCall } from '@/components/mcp/tool-call-block';

const markdownComponents: Components = {
  table: ({ children }) => (
    <table>{children}</table>
  ),
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
}

export function MessageList({ messages, isStreaming, streamingContent }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming]);

  const handleCopy = useCallback(async (content: string, msgId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <ScrollArea className="flex-1 px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-4 animate-fade-in-up', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
{msg.role === 'assistant' && (
              <Avatar className="h-10 w-10 shrink-0 mt-4">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/10">
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            )}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="w-full mt-2">
                <ToolCallBlock toolCalls={msg.toolCalls} />
              </div>
            )}
            {msg.role === 'user' ? (
              <div className="msg-actions-wrapper cursor-pointer">
                <div className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground rounded-br-md shadow-sm">
                  <p className="text-[15px] leading-relaxed">{msg.content}</p>
                </div>
                <div className="msg-action-btn">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground gap-1 [&_svg]:size-3"
                    onClick={() => handleCopy(msg.content, msg.id)}
                  >
                    {copiedId === msg.id ? (
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
                </div>
              </div>
            ) : (
              <div className="bg-card px-5 py-2 text-foreground">
                <div className="prose dark:prose-invert max-w-none text-[15px]">
                  <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {msg.role === 'user' && (
              <Avatar className="h-10 w-10 shrink-0 mt-0.5 ring-2 ring-primary/10">
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="flex gap-4 justify-start animate-fade-in-up">
<Avatar className="h-10 w-10 shrink-0 mt-4">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/10">
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            <div className="bg-card px-5 py-2 text-foreground">
              <div className="prose dark:prose-invert max-w-none text-[15px]">
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {streamingContent}
                </ReactMarkdown>
                <span className="inline-block ml-1 animate-pulse">▌</span>
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-4 justify-start animate-fade-in-up">
            <Avatar className="h-10 w-10 shrink-0 mt-2">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/10">
                <Bot className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-card px-5 py-3 h-10 mt-2 flex items-center justify-center">
              <div className="flex gap-1.5">
                <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}