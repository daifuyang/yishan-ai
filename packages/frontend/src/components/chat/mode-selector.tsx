'use client';

import { Check, ChevronDown, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type SandboxMode = 'read-only' | 'workspace-write' | 'full-access';

const MODE_LABELS: Record<SandboxMode, string> = {
  'read-only': '只读',
  'workspace-write': '工作区写入',
  'full-access': '完全访问',
};

interface ModeSelectorProps {
  value: SandboxMode;
  onChange: (mode: SandboxMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-medium',
            'text-muted-foreground hover:text-foreground hover:bg-muted/80',
            'transition-colors duration-150 outline-none',
            'disabled:opacity-50 disabled:pointer-events-none'
          )}
        >
          <Shield className="h-4 w-4" />
          <span>{MODE_LABELS[value]}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {(Object.keys(MODE_LABELS) as SandboxMode[]).map((mode) => (
          <DropdownMenuItem key={mode} onClick={() => onChange(mode)} className="justify-between">
            <span>{MODE_LABELS[mode]}</span>
            {value === mode && <Check className="h-4 w-4 text-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
