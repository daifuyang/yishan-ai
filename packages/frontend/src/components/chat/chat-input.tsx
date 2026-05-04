'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SendHorizonal, Square } from 'lucide-react';
import { useConfigStore } from '@/stores/config-store';
import type { ChatMode } from '@/lib/constants';

interface ChatInputProps {
  onSend: (content: string, model: string, mode: ChatMode) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  defaultModel?: string;
  noBorder?: boolean;
  initialContent?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  defaultModel,
  noBorder,
  initialContent,
}: ChatInputProps) {
  const { models, fetchConfig } = useConfigStore();
  const [content, setContent] = useState(initialContent || '');
  const [model, setModel] = useState(() => defaultModel || models.defaultModel || 'MiniMax-M2.7-highspeed');
  const [mode, setMode] = useState<ChatMode>('build');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (models.models.length === 0) {
      fetchConfig();
    }
  }, [models.models.length, fetchConfig]);

  useEffect(() => {
    if (defaultModel && defaultModel !== model) {
      setModel(defaultModel);
    }
  }, [defaultModel]);

  useEffect(() => {
    if (initialContent !== undefined) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const contentLength = textarea.value.length;
      const lines = textarea.value.split('\n').length;
      const estimatedRows = Math.max(1, Math.ceil(contentLength / 50));
      const rows = Math.min(5, Math.max(1, Math.max(lines, estimatedRows)));
      textarea.rows = rows;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  const handleSend = useCallback(() => {
    if (!content.trim() || disabled || isStreaming || model === 'no-model') return;
    onSend(content, model, mode);
    setContent('');
    adjustHeight();
  }, [content, model, mode, disabled, isStreaming, onSend, adjustHeight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const isDisabled = disabled || isStreaming;
  const modelList = models.models.length > 0 ? models.models : [{ id: 'no-model', name: '暂无' }];

  return (
    <div className={noBorder ? 'p-3' : 'border rounded-2xl p-4 shadow-md glass'}>
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isStreaming ? 'AI 正在回复...' : '输入消息...'}
        disabled={isDisabled}
        className="w-full border-0 shadow-none focus-visible:ring-0 resize-none mb-3 text-[15px] bg-transparent chat-input-textarea"
      />
      <div className="flex items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as ChatMode)} disabled={isDisabled}>
          <SelectTrigger className="w-[90px] h-8 text-sm border-muted-foreground/20">
            <SelectValue placeholder="模式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plan">Plan</SelectItem>
            <SelectItem value="build">Build</SelectItem>
          </SelectContent>
        </Select>

        <Select value={model} onValueChange={setModel} disabled={isDisabled}>
          <SelectTrigger className="w-[170px] h-8 text-sm border-muted-foreground/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modelList.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {isStreaming ? (
          <Button variant="outline" onClick={onStop} className="h-8 px-3 gap-1.5">
            <Square className="w-3.5 h-3.5" />
            停止
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={!content.trim() || isDisabled || model === 'no-model'} className="h-8 px-4 gap-1.5">
            <SendHorizonal className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
