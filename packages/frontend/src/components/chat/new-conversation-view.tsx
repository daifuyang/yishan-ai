'use client';

import { ArrowUp, ChevronDown, Folder, Plus, Square } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/stores/config-store';
import { ModeSelector } from './mode-selector';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '上午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function shortenPath(fullPath: string): string {
  if (!fullPath) return '未设置工作目录';
  const parts = fullPath.split('/').filter(Boolean);
  if (parts.length <= 2) return fullPath;
  return `~/${parts.slice(-2).join('/')}`;
}

interface NewConversationViewProps {
  onSend: (content: string, model: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  defaultModel?: string;
  cwd: string;
  onCwdChange: (cwd: string) => void;
}

export function NewConversationView({
  onSend,
  onStop,
  isStreaming,
  disabled,
  defaultModel,
  cwd,
  onCwdChange,
}: NewConversationViewProps) {
  const { models, sandbox, fetchConfig } = useConfigStore();
  const [content, setContent] = useState('');
  const [model, setModel] = useState(
    () => defaultModel || models.defaultModel || 'MiniMax-M2.7-highspeed'
  );
  const [mode, setMode] = useState(sandbox.defaultMode);
  const [picking, setPicking] = useState(false);
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
  }, [defaultModel, model]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxH = 200;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxH)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxH ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  const handleSend = useCallback(() => {
    if (!content.trim() || disabled || isStreaming || model === 'no-model') return;
    onSend(content, model);
    setContent('');
  }, [content, model, disabled, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handlePickWorkspace = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    try {
      const { apiUrl } = await import('@/lib/api-base');
      const res = await fetch(apiUrl('/api/workspace/pick-directory'), { method: 'POST' });
      if (res.ok && res.status !== 204) {
        const data = await res.json();
        if (data.path) onCwdChange(data.path);
      }
    } catch {
      // user cancelled
    } finally {
      setPicking(false);
    }
  }, [picking, onCwdChange]);

  const isDisabled = disabled || isStreaming;
  const canSend = content.trim().length > 0 && !isDisabled && model !== 'no-model';
  const modelList = models.models.length > 0 ? models.models : [{ id: 'no-model', name: '暂无' }];

  return (
    <div className="flex flex-1 items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-[880px] flex flex-col -translate-y-[6vh]">
        {/* Greeting */}
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground mb-5">
          {getGreeting()}
        </h1>

        {/* Context Toolbar */}
        <div className="flex items-center gap-1 mb-6">
          <button
            type="button"
            onClick={handlePickWorkspace}
            disabled={isDisabled || picking}
            className={cn(
              'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-medium',
              'text-muted-foreground hover:text-foreground hover:bg-muted/80',
              'transition-colors duration-150',
              'disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            <Folder className="h-4 w-4" />
            <span className="truncate max-w-[200px]">
              {picking ? '选择中...' : shortenPath(cwd)}
            </span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <ModeSelector value={mode} onChange={setMode} disabled={isDisabled} />
        </div>

        {/* Composer */}
        <div
          className={cn(
            'border border-border rounded-[20px] shadow-sm flex flex-col',
            'transition-shadow duration-200',
            'focus-within:shadow-md focus-within:border-border/80'
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'AI 正在回复...' : '描述你想完成的任务...'}
            disabled={isDisabled}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className={cn(
              'w-full border-0 outline-none resize-none bg-transparent',
              'text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground',
              'px-[18px] pt-4 pb-2 min-h-[80px]',
              'disabled:opacity-50'
            )}
            style={{ height: 'auto', maxHeight: '200px' }}
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            {/* Left tools */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isDisabled}
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'transition-colors duration-150',
                  'disabled:opacity-50 disabled:pointer-events-none'
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Model selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isDisabled}>
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1 h-8 px-2.5 rounded-lg text-[13px] font-medium',
                      'text-muted-foreground hover:text-foreground hover:bg-muted/80',
                      'transition-colors duration-150 outline-none',
                      'disabled:opacity-50 disabled:pointer-events-none'
                    )}
                  >
                    <span className="truncate max-w-[120px]">
                      {modelList.find((m) => m.id === model)?.name || model}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[180px] max-h-[300px] overflow-y-auto"
                >
                  {modelList.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      className="justify-between"
                    >
                      <span>{m.name}</span>
                      {model === m.id && <span className="text-foreground text-xs">&#10003;</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Send / Stop button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="h-9 w-9 rounded-full flex items-center justify-center bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center transition-colors duration-150',
                    canSend
                      ? 'bg-foreground text-background hover:bg-foreground/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
