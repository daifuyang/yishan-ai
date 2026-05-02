'use client';

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Copy, Check, Cog } from "lucide-react";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: "pending" | "running" | "completed" | "error";
}

interface ToolCallBlockProps {
  toolCalls: ToolCall[];
  variant?: "full" | "compact";
}

function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function StatusIcon({ status, size = 'sm' }: { status: ToolCall["status"]; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3';
  switch (status) {
    case "pending":
      return <Loader2 className={`${sizeClass} animate-spin text-yellow-500`} />;
    case "running":
      return <Loader2 className={`${sizeClass} animate-spin text-blue-500`} />;
    case "completed":
      return <CheckCircle2 className={`${sizeClass} text-green-500`} />;
    case "error":
      return <XCircle className={`${sizeClass} text-red-500`} />;
  }
}

function ToolCallBadge({ toolCall }: { toolCall: ToolCall }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
      <StatusIcon status={toolCall.status} />
      <span className="font-mono">{toolCall.name}</span>
    </span>
  );
}

export function ToolCallBadgeList({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (toolCalls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {toolCalls.map((tc) => (
        <ToolCallBadge key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}

function ToolCallItem({
  toolCall,
  copiedId,
  onCopy,
}: {
  toolCall: ToolCall;
  copiedId: string | null;
  onCopy: (content: string, id: string) => void;
}) {
  return (
    <div className="border rounded-md bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
        <StatusIcon status={toolCall.status} />
        <span className="font-mono text-sm">{toolCall.name}</span>
        <button
          className="ml-auto h-auto py-0.5 px-1 text-muted-foreground hover:text-foreground gap-1"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(formatJson(toolCall.input), toolCall.id);
          }}
        >
          {copiedId === toolCall.id ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>

      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground mb-1">输入:</p>
        <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-40">
          <code>{formatJson(toolCall.input)}</code>
        </pre>
      </div>

      {typeof toolCall.output !== 'undefined' && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground mb-1">输出:</p>
          <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-48">
            <code>{formatJson(toolCall.output)}</code>
          </pre>
        </div>
      )}

      {toolCall.error && (
        <div className="px-3 pb-2">
          <p className="text-xs text-red-500 mb-1">错误:</p>
          <pre className="text-xs bg-red-500/10 text-red-500 rounded p-2 overflow-auto max-h-40">
            <code>{toolCall.error}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export function ToolCallBlock({ toolCalls, variant = "full" }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const runningCount = toolCalls.filter((tc) => tc.status === "pending" || tc.status === "running").length;
  const completedCount = toolCalls.filter((tc) => tc.status === "completed").length;
  const errorCount = toolCalls.filter((tc) => tc.status === "error").length;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-3 p-2 bg-muted/20 rounded-lg border">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Cog className="h-4 w-4" />
          <span>使用了 {toolCalls.length} 个工具</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {runningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-xs">
              <StatusIcon status="running" size="sm" />
              <span className="font-medium">{runningCount}</span>
            </span>
          )}
          {completedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 text-green-600 text-xs">
              <StatusIcon status="completed" size="sm" />
              <span className="font-medium">{completedCount}</span>
            </span>
          )}
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-600 text-xs">
              <StatusIcon status="error" size="sm" />
              <span className="font-medium">{errorCount}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 ml-auto">
          {toolCalls.map((tc) => (
            <span
              key={tc.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 text-xs font-mono"
              title={`${tc.name} - ${tc.status}`}
            >
              <StatusIcon status={tc.status} size="sm" />
              <span className="max-w-[80px] truncate">{tc.name}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">
          工具调用 ({toolCalls.length})
        </span>
        {runningCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            {runningCount} 运行中
          </span>
        )}
        {errorCount > 0 && (
          <span className="text-xs text-red-500">{errorCount} 错误</span>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {toolCalls.map((toolCall) => (
            <ToolCallItem
              key={toolCall.id}
              toolCall={toolCall}
              copiedId={copiedId}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
