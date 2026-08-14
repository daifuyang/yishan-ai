import { execFile } from 'node:child_process';
import { isSandboxAvailable } from './probe.js';
import type { SandboxMode, SandboxOptions, SandboxResult } from './types.js';

function buildSbplProfile(mode: SandboxMode, workspaceRoot: string): string {
  switch (mode) {
    case 'read-only':
      return ['(version 1)', '(allow default)', '(deny file-write*)'].join('\n');

    case 'workspace-write':
      return [
        '(version 1)',
        '(allow default)',
        '(deny file-write*)',
        `(allow file-write* (subpath "${workspaceRoot}"))`,
        '(allow file-write* (subpath "/tmp"))',
        '(allow file-write* (subpath "/private/tmp"))',
        '(allow file-write* (subpath "/dev/null"))',
      ].join('\n');

    case 'full-access':
      return ['(version 1)', '(allow default)'].join('\n');
  }
}

export async function runInSandbox(options: SandboxOptions): Promise<SandboxResult> {
  if (!isSandboxAvailable()) {
    return {
      stdout: '',
      stderr:
        'Sandbox unavailable: sandbox-exec is not functional on this system. Execution refused.',
      exitCode: 1,
      denied: true,
    };
  }

  const { command, policy, timeout = 60000, cwd } = options;
  const profile = buildSbplProfile(policy.mode, policy.workspaceRoot);

  return new Promise((resolve) => {
    const child = execFile(
      'sandbox-exec',
      ['-p', profile, '/bin/bash', '-c', command],
      {
        cwd: cwd || policy.workspaceRoot,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, TERM: 'xterm-256color' },
      },
      (error, stdout, stderr) => {
        const denied =
          stderr.includes('Operation not permitted') ||
          stderr.includes('operation not permitted') ||
          stderr.includes('deny file-write');

        if (error) {
          const exitCode =
            (error as NodeJS.ErrnoException & { code?: number | string }).code === 'ETIMEDOUT'
              ? 124
              : ((error as { code?: number }).code ?? 1);
          resolve({
            stdout: stdout || '',
            stderr: stderr || error.message,
            exitCode: typeof exitCode === 'number' ? exitCode : 1,
            denied,
          });
          return;
        }

        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0,
          denied,
        });
      }
    );

    if (timeout > 0) {
      setTimeout(() => {
        child.kill('SIGKILL');
      }, timeout + 1000);
    }
  });
}

export { isPathContained } from './path-check.js';
export { isSandboxAvailable } from './probe.js';
export type { SandboxMode, SandboxOptions, SandboxPolicy, SandboxResult } from './types.js';
