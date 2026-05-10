// TODO: Permission ask/preview system
// 本期只记录日志，后续实现用户确认机制

type PermissionAction = 'read' | 'write' | 'edit' | 'delete' | 'exec' | 'network';

interface PermissionLogEntry {
  timestamp: number;
  sessionId: string;
  action: PermissionAction;
  path?: string;
  command?: string;
  allowed: boolean;
  reason?: string;
}

const permissionLogs: PermissionLogEntry[] = [];

const isDev = process.env.NODE_ENV !== 'production';

function permissionLog(
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  meta?: Record<string, unknown>
) {
  if (!isDev) return;
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[${timestamp}] [Permission] [${level}] ${message}${metaStr}`);
}

export function logPermission(
  sessionId: string,
  action: PermissionAction,
  options: {
    path?: string;
    command?: string;
    allowed?: boolean;
    reason?: string;
  } = {}
): void {
  const entry: PermissionLogEntry = {
    timestamp: Date.now(),
    sessionId,
    action,
    path: options.path,
    command: options.command,
    allowed: options.allowed ?? true,
    reason: options.reason,
  };

  permissionLogs.push(entry);

  permissionLog('INFO', `Permission ${action}`, {
    sessionId,
    path: options.path,
    command: options.command,
    allowed: entry.allowed,
  });
}

export function getPermissionLogs(sessionId?: string): PermissionLogEntry[] {
  if (sessionId) {
    return permissionLogs.filter((log) => log.sessionId === sessionId);
  }
  return [...permissionLogs];
}

export async function checkPermission(
  sessionId: string,
  action: PermissionAction,
  options: {
    path?: string;
    command?: string;
  } = {}
): Promise<boolean> {
  logPermission(sessionId, action, {
    ...options,
    allowed: true,
  });

  return true;
}
