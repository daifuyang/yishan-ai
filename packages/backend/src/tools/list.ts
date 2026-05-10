import * as fs from 'node:fs';
import * as path from 'node:path';
import { listDirInSandbox } from './docker-sandbox.js';
import { logPermission } from './permission-log.js';
import type { ExecuteResult, Tool, ToolContext } from './types.js';

interface ListArgs {
  path: string;
  recursive?: boolean;
}

function isWithinDirectory(targetPath: string, directory: string): boolean {
  const resolved = path.resolve(targetPath);
  const dirResolved = path.resolve(directory);
  return resolved.startsWith(dirResolved + path.sep) || resolved === dirResolved;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function createListTool(): Tool {
  return {
    id: 'list',
    description: 'List contents of a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to list',
        },
        recursive: {
          type: 'boolean',
          description: 'List recursively (default false)',
        },
      },
      required: ['path'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const { path: dirPath, recursive = false } = args as ListArgs;

      if (!dirPath) {
        throw new Error('path is required');
      }

      const resolvedPath = path.isAbsolute(dirPath)
        ? dirPath
        : path.resolve(ctx.directory, dirPath);

      if (!isWithinDirectory(resolvedPath, ctx.directory)) {
        throw new Error(`Access denied: ${dirPath} is outside workspace`);
      }

      logPermission(ctx.sessionId, 'read', { path: resolvedPath });

      try {
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`Directory not found: ${dirPath}`);
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isDirectory()) {
          throw new Error(`${dirPath} is not a directory`);
        }

        let output: string;

        if (recursive) {
          output = await listDirInSandbox(`${resolvedPath} -R`, ctx.directory);
        } else {
          const entries = fs.readdirSync(resolvedPath);
          const formatted: string[] = [];

          for (const entry of entries.sort()) {
            const fullPath = path.join(resolvedPath, entry);
            try {
              const entryStat = fs.statSync(fullPath);
              if (entryStat.isDirectory()) {
                formatted.push(`${entry}/`);
              } else if (entryStat.isSymbolicLink()) {
                formatted.push(`${entry}@`);
              } else {
                const size = formatFileSize(entryStat.size);
                formatted.push(`${entry} (${size})`);
              }
            } catch {
              formatted.push(`${entry}?`);
            }
          }

          output = formatted.join('\n');
        }

        return {
          title: path.basename(resolvedPath) || '/',
          output,
          metadata: {
            path: resolvedPath,
            recursive,
          },
        };
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'EACCES') {
          throw new Error(`Permission denied: ${dirPath}`);
        }
        throw error;
      }
    },
  };
}
