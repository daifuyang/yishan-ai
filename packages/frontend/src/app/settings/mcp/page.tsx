'use client';

import { AlertTriangle, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type MCPServer, useMCPSStore } from '@/stores/mcp-store';

export default function MCPSettingsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TooltipProvider>
        <MCPServerList />
      </TooltipProvider>
    </div>
  );
}

function MCPServerList() {
  const { servers, fetchServers, addServer, updateServer, removeServer, fetchTools } =
    useMCPSStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
    fetchTools();
  }, [fetchServers, fetchTools]);

  const openAddDialog = () => {
    setDialogMode('add');
    setJsonInput('');
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
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        setJsonError(`JSON 解析错误：${e.message}`);
      } else {
        setJsonError((e as Error).message);
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

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h3 className="font-medium">已配置的服务器 ({servers.length})</h3>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
          添加服务器
        </Button>
      </div>

      {/* Server List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {servers.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              暂无 MCP 服务器，点击「添加服务器」开始
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.name}
                className="flex items-center gap-4 p-4 border rounded-lg bg-card"
              >
                <span className="font-medium truncate flex-1">{server.name}</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        openEditDialog(server);
                      }}
                    >
                      <DropdownMenuItemIcon>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuItemIcon>
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setDeleteConfirm(server.name);
                      }}
                      className="text-red-600 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <DropdownMenuItemIcon>
                        <Trash2 className="h-4 w-4" />
                      </DropdownMenuItemIcon>
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={() => handleToggleEnabled(server)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {server.enabled ? '启用' : '停用'}
                  </span>
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
              <div className="text-sm text-muted-foreground">
                服务器名称：<span className="font-mono font-medium">{editingServer.name}</span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="mcp-json-config" className="text-sm font-medium">
                  JSON 配置
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setJsonInput(
                      '{\n  "mcpServers": {\n    "server-name": {\n      "command": "npx",\n      "args": ["-y", "@some/server"]\n    }\n  }\n}'
                    )
                  }
                >
                  填充模板
                </Button>
              </div>
              <Textarea
                id="mcp-json-config"
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
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
