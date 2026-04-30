'use client';

import { useState, useEffect } from "react";
import { Bot, Plus, Trash2, Plug, Unplug, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMCPSStore, MCPServer } from "@/stores/mcp-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface MCPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MCPDialog({ open, onOpenChange }: MCPDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            MCP 服务器
          </SheetTitle>
          <SheetDescription>
            管理 MCP 服务器和 AI 工具
          </SheetDescription>
        </SheetHeader>
        <MCPDialogContent open={open} />
      </SheetContent>
    </Sheet>
  );
}

interface MCPDialogContentProps {
  open: boolean;
}

function MCPDialogContent({ open }: MCPDialogContentProps) {
  const { servers, fetchServers, addServer, updateServer, removeServer, fetchTools } = useMCPSStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchServers();
      fetchTools();
    }
  }, [open, fetchServers, fetchTools]);

  const openAddDialog = () => {
    setDialogMode('add');
    setJsonInput("");
    setJsonError(null);
    setEditingServer(null);
    setDialogOpen(true);
  };

  const openEditDialog = (server: MCPServer) => {
    setDialogMode('edit');
    setEditingServer(server);
    setJsonInput(JSON.stringify({ [server.name]: server.config }, null, 2));
    setJsonError(null);
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        setJsonError('JSON 格式错误：需要包含 mcpServers 对象');
        return;
      }

      if (dialogMode === 'add') {
        for (const [name, config] of Object.entries(parsed.mcpServers)) {
          await addServer(name, config as MCPServer['config']);
        }
      } else if (dialogMode === 'edit' && editingServer) {
        const newConfig = parsed[editingServer.name];
        if (newConfig) {
          await updateServer(editingServer.name, { config: newConfig });
        }
      }

      setDialogOpen(false);
      fetchServers();
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        setJsonError('JSON 解析错误：' + e.message);
      } else {
        setJsonError(e.message);
      }
    }
  };

  const handleDelete = async (name: string) => {
    await removeServer(name);
    setDeleteConfirm(null);
    fetchServers();
  };

  const handleToggleEnabled = async (server: MCPServer) => {
    await updateServer(server.name, { enabled: !server.enabled });
    fetchServers();
  };

  const getStatusText = (server: MCPServer) => {
    if (!server.enabled) return "已停用";
    switch (server.status) {
      case "connected":
        return "已连接";
      case "connecting":
        return "连接中...";
      case "error":
        return "错误";
      default:
        return "已断开";
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="font-medium text-sm">
          已配置的服务器 ({servers.length})
        </h3>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
          添加服务器
        </Button>
      </div>

      {/* Server List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {servers.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              暂无 MCP 服务器，点击「添加服务器」开始
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.name}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {server.enabled && server.status === 'connected' ? (
                    <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  ) : (
                    <div className="h-2 w-2 rounded-full border border-gray-400 shrink-0" />
                  )}
                  <span className="font-medium truncate">{server.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({getStatusText(server)})
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => openEditDialog(server)}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>编辑</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => handleToggleEnabled(server)}>
                        {server.enabled ? (
                          <Unplug className="h-4 w-4" />
                        ) : (
                          <Plug className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{server.enabled ? "停用" : "启用"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(server.name)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>删除</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? '添加服务器' : '编辑服务器'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'add'
                ? '粘贴 MCP 服务器的 JSON 配置'
                : '编辑 JSON 配置，修改将直接覆盖原配置'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {dialogMode === 'edit' && editingServer && (
              <div className="px-1 text-sm text-muted-foreground">
                服务器名称：<span className="font-mono font-medium">{editingServer.name}</span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">JSON 配置</label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setJsonInput('{\n  "mcpServers": {\n    "server-name": {\n      "command": "npx",\n      "args": ["-y", "@some/server"]\n    }\n  }\n}')}
                >
                  填充模板
                </Button>
              </div>
              <Textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setJsonError(null);
                }}
                placeholder='{\n  "mcpServers": {\n    "server-name": {\n      "command": "npx",\n      "args": ["-y", "@some/server"]\n    }\n  }\n}'
                className="min-h-[200px] text-sm font-mono"
              />
              {jsonError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {jsonError}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={!jsonInput.trim()}>
              {dialogMode === 'add' ? '确认添加' : '保存更改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除服务器「{deleteConfirm}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
