'use client';

import { useEffect, useState } from 'react';
import { Shield, FolderOpen, AlertTriangle } from 'lucide-react';
import { DirectoryPicker } from '@/components/settings/directory-picker';
import { Switch } from '@/components/ui/switch';
import { useConfigStore } from '@/stores/config-store';
import { TooltipProvider } from '@/components/ui/tooltip';

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
  const { workspace, tools, fetchConfig, updateConfig } = useConfigStore();
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

  const handleExecSecurityChange = async (security: 'allow' | 'ask' | 'deny') => {
    await updateConfig({ tools: { ...tools, exec: { ...tools.exec, security } } });
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
          <p className="text-sm text-muted-foreground">
            配置工作目录和执行权限
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Workspace Section */}
        <section className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-5 w-5" />
            <h4 className="font-medium">工作目录</h4>
          </div>

          <DirectoryPicker
            directories={workspace.directories}
            onChange={handleDirectoriesChange}
          />

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

        {/* Execution Permission Section */}
        <section className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5" />
            <h4 className="font-medium">执行权限</h4>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">安全级别</label>
            <div className="flex gap-4">
              {(['allow', 'ask', 'deny'] as const).map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exec-security"
                    value={level}
                    checked={tools.exec.security === level}
                    onChange={() => handleExecSecurityChange(level)}
                    className="accent-primary"
                  />
                  <span className="text-sm">
                    {level === 'allow' ? '允许' : level === 'ask' ? '询问' : '拒绝'}
                  </span>
                </label>
              ))}
            </div>

            <div className="text-sm text-muted-foreground space-y-1 pl-6">
              <p>• <strong>允许</strong>：AI 可以直接执行命令</p>
              <p>• <strong>询问</strong>：AI 执行前需要用户确认</p>
              <p>• <strong>拒绝</strong>：AI 无法执行命令</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}