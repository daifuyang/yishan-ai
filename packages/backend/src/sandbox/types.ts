export type SandboxMode = 'read-only' | 'workspace-write' | 'full-access';

export interface SandboxPolicy {
  mode: SandboxMode;
  workspaceRoot: string;
  sessionId: string;
}

export interface SandboxOptions {
  command: string;
  policy: SandboxPolicy;
  timeout?: number;
  cwd?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  denied: boolean;
}
