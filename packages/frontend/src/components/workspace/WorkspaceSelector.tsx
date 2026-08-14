'use client';

import { Folder } from 'lucide-react';
import { useCallback, useState } from 'react';
import { apiUrl } from '@/lib/api-base';

interface WorkspaceSelectorProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

function shortenPath(fullPath: string): string {
  if (!fullPath) return '未设置工作目录';
  const parts = fullPath.split('/').filter(Boolean);
  if (parts.length <= 2) return fullPath;
  return `~/${parts.slice(-2).join('/')}`;
}

export function WorkspaceSelector({ value, onChange, disabled }: WorkspaceSelectorProps) {
  const [picking, setPicking] = useState(false);

  const handlePick = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    try {
      const res = await fetch(apiUrl('/api/workspace/pick-directory'), { method: 'POST' });
      if (res.ok && res.status !== 204) {
        const data = await res.json();
        if (data.path) {
          onChange(data.path);
        }
      }
    } catch {
      // user cancelled or error
    } finally {
      setPicking(false);
    }
  }, [picking, onChange]);

  return (
    <button
      type="button"
      onClick={handlePick}
      disabled={disabled || picking}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-full disabled:opacity-50"
    >
      <Folder className="h-3 w-3 shrink-0" />
      <span className="truncate">{picking ? '选择中...' : shortenPath(value)}</span>
    </button>
  );
}
