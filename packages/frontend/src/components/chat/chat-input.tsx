'use client';

import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SendHorizonal, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string, model: string, mode: 'plan' | 'build') => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  defaultModel?: string;
  models?: { id: string; name: string }[];
}

const DEFAULT_MODELS = [
  { id: 'MiniMax-M2.7', name: 'MiniMax-M2.7' },
  { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7-highspeed' },
  { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5' },
  { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5-highspeed' },
  { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1' },
  { id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1-highspeed' },
];

export function ChatInput({ onSend, onStop, isStreaming, disabled, defaultModel = 'MiniMax-M2.7', models = DEFAULT_MODELS }: ChatInputProps) {
  const [content, setContent] = useState('');
  const [model, setModel] = useState(defaultModel);
  const [mode, setMode] = useState<'plan' | 'build'>('build');

  const handleSend = () => {
    if (!content.trim() || disabled || isStreaming) return;
    onSend(content, model, mode);
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || isStreaming;

  return (
    <div className="border-t p-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isStreaming ? 'AI 正在回复...' : '输入消息...'}
        disabled={isDisabled}
        className="mb-2 min-h-[60px] max-h-[120px]"
        rows={1}
      />
      <div className="flex items-center justify-between">
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as 'plan' | 'build')} disabled={isDisabled}>
          <ToggleGroupItem value="plan" size="sm">Plan</ToggleGroupItem>
          <ToggleGroupItem value="build" size="sm">Build</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={setModel} disabled={isDisabled}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isStreaming ? (
            <Button variant="outline" onClick={onStop}>
              <Square className="w-4 h-4" />
              停止
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={!content.trim() || isDisabled}>
              <SendHorizonal className="w-4 h-4" />
              发送
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}