'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming]);

  const handleCopy = async (content: string, msgId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <ScrollArea className="flex-1 px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'user' ? (
              <div className="msg-actions-wrapper cursor-pointer">
                <div className="px-4 py-2 rounded-xl bg-neutral-800 text-white">
                  <p className="text-[15px] leading-relaxed">{msg.content}</p>
                </div>
                <div className="msg-action-btn">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 px-2 text-neutral-500 hover:text-neutral-700 gap-1 [&_svg]:size-3"
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
              <div className="max-w-[85%] px-4 py-2 rounded-xl text-foreground">
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-4 py-2 rounded-xl text-foreground">
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
            <div className="max-w-[85%] px-4 py-2 rounded-xl">
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}