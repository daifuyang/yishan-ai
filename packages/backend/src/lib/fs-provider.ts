import fs from 'fs-extra';
import path from 'node:path';
import { globby } from 'globby';
import * as Diff from 'diff';
import { configManager } from './config-manager.js';

const PROTECTED_PATHS = ['/etc', '/root', '/.ssh', '/proc', '/sys'];

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
      const isWithinWorkspace = allowedDirs.some(dir => {
        const resolvedDir = path.resolve(dir);
        return normalized.startsWith(resolvedDir) || normalized === resolvedDir;
      });
      if (!isWithinWorkspace) {
        return { valid: false, reason: 'Path is outside allowed workspace directories' };
      }
    }
  }

  for (const protectedPath of PROTECTED_PATHS) {
    if (normalized.startsWith(protectedPath)) {
      return { valid: false, reason: `Path is within protected system directory: ${protectedPath}` };
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
    } catch (error: any) {
      return { content: '', error: error.message };
    }
  },

  async write_file(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    try {
      await fs.ensureFile(filePath);
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async edit_file(filePath: string, oldString: string, newString: string): Promise<{ success: boolean; error?: string }> {
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
    } catch (error: any) {
      return { success: false, error: error.message };
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
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async search_files(pattern: string, options?: { cwd?: string; content?: boolean }): Promise<{ files: string[]; error?: string }> {
    const cwd = options?.cwd || configManager.get('workspace.directories')?.[0] || process.cwd();
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
    } catch (error: any) {
      return { files: [], error: error.message };
    }
  },

  async list_directory(dirPath: string, options?: { recursive?: boolean }): Promise<{ entries: string[]; error?: string }> {
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
        const fullPaths = entries.map(e => path.join(dirPath, e));
        return { entries: fullPaths };
      }
    } catch (error: any) {
      return { entries: [], error: error.message };
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
    } catch (error: any) {
      return { diff: '', error: error.message };
    }
  },
};

export default fsProvider;