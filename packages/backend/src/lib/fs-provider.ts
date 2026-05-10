import path from 'node:path';
import * as Diff from 'diff';
import fs from 'fs-extra';
import { globby } from 'globby';
import { configManager } from './config-manager.js';

const PROTECTED_PATHS = ['/etc', '/root', '/.ssh', '/proc', '/sys'];
const DANGEROUS_PATTERNS = [
  /\/etc[/\s]/,
  /\/root[/\s]/,
  /\/\.ssh[/\s]/,
  /\/proc[/\s]/,
  /\/sys[/\s]/,
];

function isDangerousPath(p: string): boolean {
  for (const regex of DANGEROUS_PATTERNS) {
    if (regex.test(p)) return true;
  }
  return false;
}

function isWithinWorkspace(p: string): boolean {
  const config = configManager.getAll();
  const workspaceDirs = config.workspace?.directories ?? [];
  if (workspaceDirs.length === 0) return true;

  const normalized = path.resolve(p);
  return workspaceDirs.some((dir) => {
    const resolvedDir = path.resolve(dir);
    return normalized.startsWith(resolvedDir) || normalized === resolvedDir;
  });
}

function expandVariables(command: string): { expanded: string; error?: string } {
  let expanded = command;

  const varRegex = /\$\{([^}]+)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null = varRegex.exec(expanded);
  while (match !== null) {
    const varName = match[1] || match[2];
    const varValue = process.env[varName];
    if (varValue === undefined) {
      return { expanded: command, error: `undefined variable: ${match[0]}` };
    }
    expanded = expanded.replace(match[0], varValue);
    match = varRegex.exec(expanded);
  }

  return { expanded };
}

function extractAbsolutePaths(command: string): string[] {
  const paths: string[] = [];
  const regex = /\/[^\s'"\\|;&$#*?]+/g;
  let match: RegExpExecArray | null = regex.exec(command);
  while (match !== null) {
    const p = match[0];
    if (p.startsWith('//')) {
      match = regex.exec(command);
      continue;
    }
    paths.push(p);
    match = regex.exec(command);
  }
  return paths;
}

export function validateBashPath(requestedPath: string): ValidationResult {
  const normalized = path.resolve(requestedPath);

  if (!isWithinWorkspace(normalized)) {
    return { valid: false, reason: 'Directory does not exist' };
  }

  if (isDangerousPath(normalized)) {
    return { valid: false, reason: 'Directory does not exist' };
  }

  return { valid: true };
}

export function validateBashCommand(command: string, cwd: string): ValidationResult {
  const expandResult = expandVariables(command);
  if (expandResult.error) {
    return { valid: false, reason: 'Directory does not exist' };
  }

  const paths = extractAbsolutePaths(expandResult.expanded);
  if (paths.length === 0) {
    return { valid: true };
  }

  for (const p of paths) {
    const resolved = path.resolve(cwd, p);

    if (!isWithinWorkspace(resolved)) {
      return { valid: false, reason: 'Directory does not exist' };
    }

    if (isDangerousPath(resolved)) {
      return { valid: false, reason: 'Directory does not exist' };
    }
  }

  return { valid: true };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validatePath(requestedPath: string): ValidationResult {
  const normalized = path.resolve(requestedPath);
  const config = configManager.getAll();

  if (config.tools?.fs?.workspaceOnly ?? true) {
    const allowedDirs = config.workspace?.directories ?? [];
    if (allowedDirs.length > 0) {
      const withinWs = allowedDirs.some((dir) => {
        const resolvedDir = path.resolve(dir);
        return normalized.startsWith(resolvedDir) || normalized === resolvedDir;
      });
      if (!withinWs) {
        return { valid: false, reason: 'Directory does not exist' };
      }
    }
  }

  for (const protectedPath of PROTECTED_PATHS) {
    if (normalized.startsWith(protectedPath)) {
      return { valid: false, reason: 'Directory does not exist' };
    }
  }

  return { valid: true };
}

export function validateDeleteOperation(): ValidationResult {
  const config = configManager.getAll();
  if (!(config.workspace?.allowDelete ?? false)) {
    return { valid: false, reason: 'Delete operation is not allowed' };
  }
  return { valid: true };
}

export const fsProvider = {
  async read_file(filePath: string): Promise<{ content: string; error?: string }> {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { content: '', error: validation.reason };
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { content };
    } catch (error: unknown) {
      const err = error as Error;
      return { content: '', error: err.message };
    }
  },

  async write_file(
    filePath: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    try {
      await fs.ensureFile(filePath);
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  },

  async edit_file(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (!content.includes(oldString)) {
        return { success: false, error: 'oldString not found in file' };
      }

      const newContent = content.replace(oldString, newString);
      await fs.writeFile(filePath, newContent, 'utf-8');
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  },

  async delete_file(filePath: string): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    const deleteValidation = validateDeleteOperation();
    if (!deleteValidation.valid) {
      return { success: false, error: deleteValidation.reason };
    }

    try {
      await fs.remove(filePath);
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  },

  async search_files(
    pattern: string,
    options?: { cwd?: string; content?: boolean }
  ): Promise<{ files: string[]; error?: string }> {
    const directories = configManager.get<string[]>('workspace.directories');
    const cwd = options?.cwd || directories?.[0] || process.cwd();
    const validation = validatePath(cwd);
    if (!validation.valid) {
      return { files: [], error: validation.reason };
    }

    try {
      const files = await globby(pattern, {
        cwd,
        absolute: true,
        onlyFiles: true,
      });
      return { files };
    } catch (error: unknown) {
      const err = error as Error;
      return { files: [], error: err.message };
    }
  },

  async list_directory(
    dirPath: string,
    options?: { recursive?: boolean }
  ): Promise<{ entries: string[]; error?: string }> {
    const validation = validatePath(dirPath);
    if (!validation.valid) {
      return { entries: [], error: validation.reason };
    }

    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return { entries: [], error: 'Path is not a directory' };
      }

      if (options?.recursive) {
        const entries = await globby('**/*', {
          cwd: dirPath,
          absolute: true,
          onlyFiles: false,
        });
        return { entries };
      } else {
        const entries = await fs.readdir(dirPath);
        const fullPaths = entries.map((e) => path.join(dirPath, e));
        return { entries: fullPaths };
      }
    } catch (error: unknown) {
      const err = error as Error;
      return { entries: [], error: err.message };
    }
  },

  async diff_files(file1: string, file2: string): Promise<{ diff: string; error?: string }> {
    const validation1 = validatePath(file1);
    if (!validation1.valid) {
      return { diff: '', error: validation1.reason };
    }

    const validation2 = validatePath(file2);
    if (!validation2.valid) {
      return { diff: '', error: validation2.reason };
    }

    try {
      const content1 = await fs.readFile(file1, 'utf-8');
      const content2 = await fs.readFile(file2, 'utf-8');

      const diff = Diff.createTwoFilesPatch(
        path.basename(file1),
        path.basename(file2),
        content1,
        content2
      );

      return { diff };
    } catch (error: unknown) {
      const err = error as Error;
      return { diff: '', error: err.message };
    }
  },
};

export default fsProvider;
