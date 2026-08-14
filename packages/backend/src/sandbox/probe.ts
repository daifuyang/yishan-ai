import { execFileSync } from 'node:child_process';

let probeResult: boolean | null = null;

export function probeSandboxExec(): boolean {
  if (probeResult !== null) return probeResult;

  try {
    const result = execFileSync(
      'sandbox-exec',
      ['-p', '(version 1)(deny default)(allow process-exec)', '/bin/echo', 'ok'],
      { timeout: 5000, encoding: 'utf-8' }
    );

    probeResult = result.trim() === 'ok';
  } catch {
    probeResult = false;
  }

  if (!probeResult) {
    console.error('[Sandbox] sandbox-exec is NOT available. All exec requests will be refused.');
  } else {
    console.log('[Sandbox] sandbox-exec probe succeeded.');
  }

  return probeResult;
}

export function isSandboxAvailable(): boolean {
  if (probeResult === null) return probeSandboxExec();
  return probeResult;
}
