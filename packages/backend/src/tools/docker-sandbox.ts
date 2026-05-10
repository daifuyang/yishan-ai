import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { configManager } from '../lib/config-manager.js';

const execAsync = promisify(exec);

const SECCOMP_PATH = path.join(os.homedir(), '.yishan-ai/isolated/seccomp.json');

export interface SandboxConfig {
  enabled: boolean;
  memoryLimit?: string;
  pidsLimit?: number;
  tmpfsSize?: string;
  readOnly?: boolean;
}

export interface SandboxOptions {
  command: string;
  workDir?: string;
  timeout?: number;
}

function getSafeDirs(): string[] {
  try {
    const configPath = path.join(os.homedir(), '.yishan-ai/config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      if (config.workspace?.directories) {
        return config.workspace.directories
          .map((d: string) => {
            if (d.startsWith('~')) return d.replace('~', os.homedir());
            return d;
          })
          .filter((d: string) => fs.existsSync(d));
      }
    }
  } catch (_e) {
    // ignore
  }
  return [`${os.homedir()}/yishan-workspace`];
}

function getDefaultConfig(): SandboxConfig {
  return {
    enabled: configManager.get('sandbox.enabled') ?? true,
    memoryLimit: configManager.get('sandbox.memoryLimit') ?? '512m',
    pidsLimit: configManager.get('sandbox.pidsLimit') ?? 64,
    tmpfsSize: configManager.get('sandbox.tmpfsSize') ?? '64m',
    readOnly: configManager.get('sandbox.readOnly') ?? false,
  };
}

export async function runInSandbox(
  options: SandboxOptions
): Promise<{ stdout: string; stderr: string }> {
  const config = getDefaultConfig();

  if (!config.enabled) {
    const { stdout, stderr } = await execAsync(options.command, {
      cwd: options.workDir,
      timeout: options.timeout || 60000,
      shell: '/bin/bash',
    });
    return { stdout, stderr };
  }

  const encodedCommand = Buffer.from(options.command).toString('base64');
  const safeDirs = getSafeDirs();
  const workDir = options.workDir || safeDirs[0];

  const dockerCmd =
    `docker run --rm ` +
    `--user $(id -u):$(id -g) ` +
    `--group-add $(id -g) ` +
    `--cap-drop ALL ` +
    `--security-opt=no-new-privileges ` +
    (fs.existsSync(SECCOMP_PATH) ? `--security-opt seccomp=${SECCOMP_PATH} ` : '') +
    `${config.readOnly ? '--read-only ' : ''}` +
    `--memory=${config.memoryLimit || '512m'} --memory-swap=${config.memoryLimit || '512m'} ` +
    `--pids-limit=${config.pidsLimit || 64} ` +
    `--ulimit nofile=1024:1024 ` +
    `--workdir ${workDir} ` +
    `--env TERM=xterm-256color ` +
    `--tmpfs /tmp:rw,noexec,nosuid,size=${config.tmpfsSize || '64m'} ` +
    `--tmpfs /var/run:rw,noexec,nosuid,size=8m ` +
    `--entrypoint /bin/bash ` +
    `${safeDirs.map((d) => `-v "${d}:${d}:rw"`).join(' ')} ` +
    `isolated -c 'echo ${encodedCommand} | base64 -d | /bin/bash'`;

  const { stdout, stderr } = await execAsync(dockerCmd, {
    cwd: options.workDir,
    timeout: options.timeout || 60000,
  });

  return { stdout, stderr };
}

export function stripAnsi(str: string): string {
  const esc = String.fromCharCode(0x1b);
  return str
    .replace(new RegExp(`${esc}\\[[0-9;]*[a-zA-Z]`, 'g'), '')
    .replace(new RegExp(`${esc}[(]?[0-?]*[ -/]*[@-~]`, 'g'), '');
}

export async function readFileInSandbox(filePath: string, workDir: string): Promise<string> {
  const config = getDefaultConfig();

  if (!config.enabled) {
    return fs.readFileSync(filePath, 'utf8');
  }

  const safeDirs = getSafeDirs();
  const volumeMounts = safeDirs.map((d) => `-v "${d}:${d}:ro"`).join(' ');

  const dockerCmd =
    `docker run --rm ` +
    `--user $(id -u):$(id -g) ` +
    `--group-add $(id -g) ` +
    `--cap-drop ALL ` +
    `--security-opt=no-new-privileges ` +
    (fs.existsSync(SECCOMP_PATH) ? `--security-opt seccomp=${SECCOMP_PATH} ` : '') +
    `--read-only ` +
    `--memory=${config.memoryLimit || '512m'} --memory-swap=${config.memoryLimit || '512m'} ` +
    `--pids-limit=${config.pidsLimit || 64} ` +
    `--ulimit nofile=1024:1024 ` +
    `--workdir ${workDir} ` +
    `--tmpfs /tmp:rw,noexec,nosuid,size=32m ` +
    `${volumeMounts} ` +
    `isolated -c 'cat "${filePath}"'`;

  const { stdout } = await execAsync(dockerCmd, {
    timeout: 30000,
  });

  return stripAnsi(stdout);
}

export async function writeFileInSandbox(
  filePath: string,
  content: string,
  workDir: string
): Promise<void> {
  const config = getDefaultConfig();

  const encodedContent = Buffer.from(content).toString('base64');
  const safeDirs = getSafeDirs();
  const volumeMounts = safeDirs.map((d) => `-v "${d}:${d}:rw"`).join(' ');

  const dockerCmd =
    `docker run --rm ` +
    `--user $(id -u):$(id -g) ` +
    `--group-add $(id -g) ` +
    `--cap-drop ALL ` +
    `--security-opt=no-new-privileges ` +
    (fs.existsSync(SECCOMP_PATH) ? `--security-opt seccomp=${SECCOMP_PATH} ` : '') +
    `--memory=${config.memoryLimit || '512m'} --memory-swap=${config.memoryLimit || '512m'} ` +
    `--pids-limit=${config.pidsLimit || 64} ` +
    `--ulimit nofile=1024:1024 ` +
    `--workdir ${workDir} ` +
    `--tmpfs /tmp:rw,noexec,nosuid,size=32m ` +
    `${volumeMounts} ` +
    `isolated -c 'echo ${encodedContent} | base64 -d > "${filePath}"'`;

  await execAsync(dockerCmd, {
    timeout: 30000,
  });
}

export async function deleteFileInSandbox(filePath: string, workDir: string): Promise<void> {
  const config = getDefaultConfig();

  const safeDirs = getSafeDirs();
  const volumeMounts = safeDirs.map((d) => `-v "${d}:${d}:rw"`).join(' ');

  const dockerCmd =
    `docker run --rm ` +
    `--user $(id -u):$(id -g) ` +
    `--group-add $(id -g) ` +
    `--cap-drop ALL ` +
    `--security-opt=no-new-privileges ` +
    (fs.existsSync(SECCOMP_PATH) ? `--security-opt seccomp=${SECCOMP_PATH} ` : '') +
    `--memory=${config.memoryLimit || '512m'} --memory-swap=${config.memoryLimit || '512m'} ` +
    `--pids-limit=${config.pidsLimit || 64} ` +
    `--ulimit nofile=1024:1024 ` +
    `--workdir ${workDir} ` +
    `--tmpfs /tmp:rw,noexec,nosuid,size=32m ` +
    `${volumeMounts} ` +
    `isolated -c 'rm "${filePath}"'`;

  await execAsync(dockerCmd, {
    timeout: 30000,
  });
}

export async function listDirInSandbox(dirPath: string, workDir: string): Promise<string> {
  const config = getDefaultConfig();

  const safeDirs = getSafeDirs();
  const volumeMounts = safeDirs.map((d) => `-v "${d}:${d}:ro"`).join(' ');

  const dockerCmd =
    `docker run --rm ` +
    `--user $(id -u):$(id -g) ` +
    `--group-add $(id -g) ` +
    `--cap-drop ALL ` +
    `--security-opt=no-new-privileges ` +
    (fs.existsSync(SECCOMP_PATH) ? `--security-opt seccomp=${SECCOMP_PATH} ` : '') +
    `--read-only ` +
    `--memory=${config.memoryLimit || '512m'} --memory-swap=${config.memoryLimit || '512m'} ` +
    `--pids-limit=${config.pidsLimit || 64} ` +
    `--ulimit nofile=1024:1024 ` +
    `--workdir ${workDir} ` +
    `--tmpfs /tmp:rw,noexec,nosuid,size=32m ` +
    `${volumeMounts} ` +
    `isolated -c 'ls -la "${dirPath}"'`;

  const { stdout } = await execAsync(dockerCmd, {
    timeout: 30000,
  });

  return stripAnsi(stdout);
}

export async function globInSandbox(pattern: string, workDir: string): Promise<string> {
  const config = getDefaultConfig();

  const safeDirs = getSafeDirs();
  const volumeMounts = safeDirs.map((d) => `-v "${d}:${d}:ro"`).join(' ');

  const dockerCmd =
    `docker run --rm ` +
    `--user $(id -u):$(id -g) ` +
    `--group-add $(id -g) ` +
    `--cap-drop ALL ` +
    `--security-opt=no-new-privileges ` +
    (fs.existsSync(SECCOMP_PATH) ? `--security-opt seccomp=${SECCOMP_PATH} ` : '') +
    `--read-only ` +
    `--memory=${config.memoryLimit || '512m'} --memory-swap=${config.memoryLimit || '512m'} ` +
    `--pids-limit=${config.pidsLimit || 64} ` +
    `--ulimit nofile=1024:1024 ` +
    `--workdir ${workDir} ` +
    `--tmpfs /tmp:rw,noexec,nosuid,size=32m ` +
    `${volumeMounts} ` +
    `isolated -c 'find . -name "${pattern}" 2>/dev/null | head -100'`;

  const { stdout } = await execAsync(dockerCmd, {
    timeout: 30000,
  });

  return stripAnsi(stdout);
}

export async function grepInSandbox(
  pattern: string,
  dirPath: string,
  workDir: string,
  options: { include?: string; caseSensitive?: boolean } = {}
): Promise<string> {
  const config = getDefaultConfig();

  const safeDirs = getSafeDirs();
  const volumeMounts = safeDirs.map((d) => `-v "${d}:${d}:ro"`).join(' ');

  let grepCmd = 'grep';
  if (!options.caseSensitive) {
    grepCmd += ' -i';
  }
  if (options.include) {
    grepCmd += ` --include="${options.include}"`;
  }
  grepCmd += ` -r "${pattern}" "${dirPath}" 2>/dev/null | head -50`;

  const dockerCmd =
    `docker run --rm ` +
    `--user $(id -u):$(id -g) ` +
    `--group-add $(id -g) ` +
    `--cap-drop ALL ` +
    `--security-opt=no-new-privileges ` +
    (fs.existsSync(SECCOMP_PATH) ? `--security-opt seccomp=${SECCOMP_PATH} ` : '') +
    `--read-only ` +
    `--memory=${config.memoryLimit || '512m'} --memory-swap=${config.memoryLimit || '512m'} ` +
    `--pids-limit=${config.pidsLimit || 64} ` +
    `--ulimit nofile=1024:1024 ` +
    `--workdir ${workDir} ` +
    `--tmpfs /tmp:rw,noexec,nosuid,size=32m ` +
    `${volumeMounts} ` +
    `isolated -c '${grepCmd}'`;

  const { stdout } = await execAsync(dockerCmd, {
    timeout: 30000,
  });

  return stripAnsi(stdout);
}
