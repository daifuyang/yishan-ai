'use client';

import React from 'react';
import { BotMessageSquare } from 'lucide-react';

interface EmptyStateProps {
  onNewChat?: () => void;
}

export function EmptyState({ onNewChat }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <BotMessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">开始一段新对话</h2>
      <p className="text-muted-foreground">输入消息开始与 AI 对话</p>
    </div>
  );
}