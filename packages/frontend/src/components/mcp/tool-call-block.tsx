"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Copy, Check } from "lucide-react";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  output?: any;
  error?: string;
  status: "pending" | "running" | "completed" | "error";
}

interface ToolCallBlockProps {
  toolCalls: ToolCall[];
}

export function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusIcon = (status: ToolCall["status"]) => {
    switch (status) {
      case "pending":
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const formatJson = (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const hasErrors = toolCalls.some((tc) => tc.status === "error");
  const hasRunning = toolCalls.some((tc) => tc.status === "pending" || tc.status === "running");

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
            <div
              key={toolCall.id}
              className="border rounded-md bg-muted/30 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
                {getStatusIcon(toolCall.status)}
                <span className="font-mono text-sm">{toolCall.name}</span>
                <button
                  className="ml-auto h-auto py-0.5 px-1 text-muted-foreground hover:text-foreground gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(formatJson(toolCall.input), toolCall.id);
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

              {toolCall.output && (
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
          ))}
        </div>
      )}
    </div>
  );
}
