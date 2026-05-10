'use client';

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Loader2,
  Plug,
  Plus,
  Settings,
  Trash2,
  Unplug,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type MCPServer, useMCPSStore } from '@/stores/mcp-store';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = 'mcp' | 'general';

interface MenuItem {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'mcp',
    label: 'MCP',
    icon: Bot,
    description: '管理 MCP 服务器和 AI 工具',
  },
  {
    id: 'general',
    label: '通用设置',
    icon: Settings,
    description: '通用配置选项',
  },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('mcp');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[600px] sm:max-w-[600px] flex flex-row p-0">
        <div className="w-[180px] border-r flex flex-col bg-muted/30">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-base">设置</SheetTitle>
            <SheetDescription className="text-xs">管理应用配置</SheetDescription>
          </SheetHeader>
          <nav className="p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors mb-1',
                    activeSection === item.id
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {activeSection === item.id && <ChevronRight className="h-3 w-3" />}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b">
            <h2 className="font-semibold">
              {menuItems.find((m) => m.id === activeSection)?.label}
            </h2>
            <p className="text-sm text-muted-foreground">
              {menuItems.find((m) => m.id === activeSection)?.description}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              {activeSection === 'mcp' && <MCPSettingsPanel open={open} />}
              {activeSection === 'general' && (
                <div className="text-sm text-muted-foreground">通用设置内容开发中...</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MCPSettingsPanelProps {
  open: boolean;
}

export function MCPSettingsPanel({ open }: MCPSettingsPanelProps) {
  const { servers, fetchServers, addServer, updateServer, removeServer, fetchTools } =
    useMCPSStore();
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchServers();
      fetchTools();
    }
  }, [open, fetchServers, fetchTools]);

  const handleImportJson = async () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        setJsonError('JSON 格式错误：需要包含 mcpServers 对象');
        return;
      }

      for (const [name, config] of Object.entries(parsed.mcpServers)) {
        await addServer(name, config as MCPServer['config']);
      }

      setJsonInput('');
      setShowJsonInput(false);
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        setJsonError(`JSON 解析错误：${e.message}`);
      } else {
        setJsonError(`导入失败：${(e as Error).message}`);
      }
    }
  };

  const handleToggleEnabled = async (server: MCPServer) => {
    await updateServer(server.name, { enabled: !server.enabled });
  };

  const handleEditSave = async () => {
    if (!editingServer) return;
    await updateServer(editingServer.name, { config: editingServer.config });
    setEditingServer(null);
  };

  const handleDelete = async (name: string) => {
    await removeServer(name);
    setDeleteConfirm(null);
  };

  const getStatusIcon = (server: MCPServer) => {
    if (!server.enabled) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    switch (server.status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (server: MCPServer) => {
    if (!server.enabled) return '已停用';
    switch (server.status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'error':
        return '错误';
      default:
        return '已断开';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">服务器列表</h3>
        <Button size="sm" onClick={() => setShowJsonInput(!showJsonInput)}>
          <Plus className="h-4 w-4 mr-1" />
          添加 JSON 配置
        </Button>
      </div>

      {showJsonInput && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">输入 JSON 配置</p>
          <Textarea
            placeholder={
              '{\n  "mcpServers": {\n    "server-name": {\n      "command": "npx",\n      "args": ["-y", "@some/server"]\n    }\n  }\n}'
            }
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
          />
          {jsonError && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {jsonError}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowJsonInput(false);
                setJsonInput('');
                setJsonError(null);
              }}
            >
              取消
            </Button>
            <Button size="sm" onClick={handleImportJson}>
              导入
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {servers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            暂无 MCP 服务器。点击「添加 JSON 配置」导入。
          </p>
        ) : (
          servers.map((server) => (
            <div
              key={server.name}
              className={cn(
                'flex items-center gap-3 p-3 border rounded-lg',
                server.enabled ? '' : 'opacity-60'
              )}
            >
              {getStatusIcon(server)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{server.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {server.config.command && (
                    <span>
                      {server.config.command} {server.config.args?.join(' ')}
                    </span>
                  )}
                  {server.config.url && <span>{server.config.url}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={server.enabled ? 'default' : 'secondary'} className="text-xs">
                  {getStatusText(server)}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={() => setEditingServer(server)}>
                      <Edit2 className="h-4 w-4" />
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
                  <TooltipContent>{server.enabled ? '停用' : '启用'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteConfirm(server.name)}
                    >
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

      {/* Edit Dialog */}
      <Dialog open={!!editingServer} onOpenChange={(open) => !open && setEditingServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 MCP 服务器</DialogTitle>
            <DialogDescription>修改服务器配置，JSON 将直接覆盖原配置</DialogDescription>
          </DialogHeader>
          {editingServer && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="mcp-server-name" className="text-sm font-medium">
                  服务器名称
                </label>
                <Input id="mcp-server-name" value={editingServer.name} disabled />
              </div>
              <div className="space-y-2">
                <label htmlFor="mcp-server-command" className="text-sm font-medium">
                  命令 (如 npx)
                </label>
                <Input
                  id="mcp-server-command"
                  value={editingServer.config.command || ''}
                  onChange={(e) =>
                    setEditingServer({
                      ...editingServer,
                      config: { ...editingServer.config, command: e.target.value, url: undefined },
                    })
                  }
                  placeholder="npx"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="mcp-server-args" className="text-sm font-medium">
                  参数 (空格分隔)
                </label>
                <Input
                  id="mcp-server-args"
                  value={editingServer.config.args?.join(' ') || ''}
                  onChange={(e) =>
                    setEditingServer({
                      ...editingServer,
                      config: {
                        ...editingServer.config,
                        args: e.target.value.split(' ').filter(Boolean),
                      },
                    })
                  }
                  placeholder="-y @some/server"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="mcp-server-url" className="text-sm font-medium">
                  或 URL (HTTP/SSE)
                </label>
                <Input
                  id="mcp-server-url"
                  value={editingServer.config.url || ''}
                  onChange={(e) =>
                    setEditingServer({
                      ...editingServer,
                      config: {
                        ...editingServer.config,
                        url: e.target.value,
                        command: undefined,
                        args: undefined,
                      },
                    })
                  }
                  placeholder="http://localhost:3000/mcp"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingServer(null)}>
              取消
            </Button>
            <Button onClick={handleEditSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
