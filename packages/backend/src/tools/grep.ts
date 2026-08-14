import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { isPathContained } from '../sandbox/path-check.js';
import type { Tool, ToolContext } from './types.js';

const execFileAsync = promisify(execFile);

interface GrepArgs {
  pattern: string;
  path?: string;
  include?: string;
  exclude?: string;
  caseSensitive?: boolean;
  limit?: number;
  after?: number;
  before?: number;
}

export function createGrepTool(): Tool {
  return {
    id: 'grep',
    description: 'Search for text patterns in files',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory path to search in (defaults to workspace root)',
        },
        include: {
          type: 'string',
          description: 'File pattern to include (e.g., *.ts, *.js)',
        },
        exclude: {
          type: 'string',
          description: 'File pattern to exclude (e.g., *.test.ts)',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case sensitive search (default false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of matches (default 50)',
        },
        after: {
          type: 'number',
          description: 'Number of lines to show after match (default 0)',
        },
        before: {
          type: 'number',
          description: 'Number of lines to show before match (default 0)',
        },
      },
      required: ['pattern'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const {
        pattern,
        path: searchPath,
        include,
        caseSensitive = false,
        limit = 50,
      } = args as GrepArgs;

      if (!pattern) {
        throw new Error('pattern is required');
      }

      const workDir = searchPath
        ? path.isAbsolute(searchPath)
          ? searchPath
          : path.resolve(ctx.directory, searchPath)
        : ctx.directory;

      if (!isPathContained(workDir, ctx.directory)) {
        throw new Error(`Access denied: ${searchPath || '/'} is outside workspace`);
      }

      try {
        const grepArgs: string[] = ['-r'];
        if (!caseSensitive) grepArgs.push('-i');
        if (include) grepArgs.push(`--include=${include}`);
        grepArgs.push(pattern, workDir);

        const { stdout } = await execFileAsync('grep', grepArgs, {
          timeout: 30000,
          maxBuffer: 5 * 1024 * 1024,
        }).catch((err) => {
          if (err.code === 1) return { stdout: '', stderr: '' };
          throw err;
        });

        const matches = stdout
          .split('\n')
          .filter((line) => line.trim())
          .slice(0, limit);

        return matches.length > 0 ? matches.join('\n') : `No matches found for "${pattern}"`;
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'EACCES') {
          throw new Error(`Permission denied: ${searchPath || '/'} `);
        }
        throw error;
      }
    },
  };
}
