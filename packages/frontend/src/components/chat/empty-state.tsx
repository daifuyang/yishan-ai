'use client';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "上午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center space-y-1">
      <p className="text-xl font-semibold tracking-tight">{getGreeting()}</p>
      <p className="text-sm text-muted-foreground tracking-wide">Yishan AI 助手</p>
    </div>
  );
}
