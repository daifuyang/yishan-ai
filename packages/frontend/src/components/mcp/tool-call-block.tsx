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

function StatusIcon({ status }: { status: ToolCall["status"] }) {
  switch (status) {
    case "pending":
      return <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />;
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
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
          <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-40">
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

  const hasErrors = toolCalls.some((tc) => tc.status === "error");
  const hasRunning = toolCalls.some((tc) => tc.status === "pending" || tc.status === "running");

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Cog className="h-3.5 w-3.5" />
          <span>使用了 {toolCalls.length} 个工具</span>
        </div>
        <ToolCallBadgeList toolCalls={toolCalls} />
        {hasErrors && <XCircle className="h-3.5 w-3.5 text-red-500" />}
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
        {hasRunning && (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            运行中
          </span>
        )}
        {hasErrors && (
          <span className="text-xs text-red-500">有错误</span>
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
