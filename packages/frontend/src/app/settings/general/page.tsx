import { Settings } from "lucide-react";

export default function GeneralSettingsPage() {
  return (
    <>
      <header className="p-6 border-b">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6" />
          <div>
            <h2 className="text-xl font-semibold">通用设置</h2>
            <p className="text-sm text-muted-foreground">
              应用通用配置选项
            </p>
          </div>
        </div>
      </header>
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          通用设置功能开发中...
        </div>
      </div>
    </>
  );
}
