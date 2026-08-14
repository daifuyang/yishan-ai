'use client';

import { AlertTriangle, FolderOpen, Lock, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DirectoryPicker } from '@/components/settings/directory-picker';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useConfigStore } from '@/stores/config-store';

export default function SecuritySettingsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TooltipProvider>
        <SecuritySettings />
      </TooltipProvider>
    </div>
  );
}

function SecuritySettings() {
  const { workspace, sandbox, approval, fetchConfig, updateConfig } = useConfigStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig().finally(() => setLoading(false));
  }, [fetchConfig]);

  const handleDirectoriesChange = async (directories: string[]) => {
    await updateConfig({ workspace: { ...workspace, directories } });
  };

  const handleAllowDeleteChange = async (allowDelete: boolean) => {
    await updateConfig({ workspace: { ...workspace, allowDelete } });
  };

  const handleApprovalPolicyChange = async (policy: 'auto-allow' | 'ask' | 'deny') => {
    await updateConfig({ approval: { ...approval, defaultPolicy: policy } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <Shield className="h-6 w-6" />
        <div>
          <h3 className="font-medium text-lg">安全设置</h3>
          <p className="text-sm text-muted-foreground">配置工作目录和执行权限</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Workspace Section */}
        <section className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-5 w-5" />
            <h4 className="font-medium">工作目录</h4>
          </div>

          <DirectoryPicker directories={workspace.directories} onChange={handleDirectoriesChange} />

          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            <Switch
              id="allow-delete"
              checked={workspace.allowDelete}
              onCheckedChange={handleAllowDeleteChange}
            />
            <label htmlFor="allow-delete" className="text-sm cursor-pointer">
              允许删除文件
            </label>
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs text-muted-foreground">
              启用后，AI 可以删除工作目录内的文件
            </span>
          </div>
        </section>

        {/* Sandbox Section */}
        <section className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5" />
            <h4 className="font-medium">沙箱隔离</h4>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              所有命令均在 macOS sandbox-exec 沙箱中执行，不可关闭。
            </p>
            <p className="text-sm">
              当前模式：
              <strong>
                {sandbox.defaultMode === 'read-only'
                  ? '只读'
                  : sandbox.defaultMode === 'workspace-write'
                    ? '工作区可写'
                    : '完全访问'}
              </strong>
            </p>
          </div>
        </section>

        {/* Approval Policy Section */}
        <section className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5" />
            <h4 className="font-medium">审批策略</h4>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium">默认策略</span>
            <div className="flex gap-4">
              {(['auto-allow', 'ask', 'deny'] as const).map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="approval-policy"
                    value={level}
                    checked={approval.defaultPolicy === level}
                    onChange={() => handleApprovalPolicyChange(level)}
                    className="accent-primary"
                  />
                  <span className="text-sm">
                    {level === 'auto-allow' ? '自动允许' : level === 'ask' ? '询问' : '拒绝'}
                  </span>
                </label>
              ))}
            </div>

            <div className="text-sm text-muted-foreground space-y-1 pl-6">
              <p>
                • <strong>自动允许</strong>：AI 可以直接执行命令（开发模式）
              </p>
              <p>
                • <strong>询问</strong>：AI 执行前需要用户确认
              </p>
              <p>
                • <strong>拒绝</strong>：AI 无法执行任何命令
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
