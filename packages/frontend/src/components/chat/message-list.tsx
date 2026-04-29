'use client';

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
}

export function MessageList({ messages, isStreaming, streamingContent }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming]);

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="max-w-3xl mx-auto py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2',
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              {msg.role === 'assistant' ? (
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {streamingContent}
                </ReactMarkdown>
                <span className="animate-pulse">▌</span>
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}