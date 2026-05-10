import * as path from 'node:path';
import { grepInSandbox } from './docker-sandbox.js';
import { logPermission } from './permission-log.js';
import type { ExecuteResult, Tool, ToolContext } from './types.js';

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

function isWithinDirectory(targetPath: string, directory: string): boolean {
  const resolved = path.resolve(targetPath);
  const dirResolved = path.resolve(directory);
  return resolved.startsWith(dirResolved + path.sep) || resolved === dirResolved;
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
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const {
        pattern,
        path: searchPath,
        include,
        exclude,
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

      if (!isWithinDirectory(workDir, ctx.directory)) {
        throw new Error(`Access denied: ${searchPath || '/'} is outside workspace`);
      }

      logPermission(ctx.sessionId, 'read', { path: workDir });

      try {
        const output = await grepInSandbox(pattern, workDir, workDir, {
          include,
          caseSensitive,
        });

        const matches = output
          .split('\n')
          .filter((line) => line.trim())
          .slice(0, limit);

        return {
          title: `Grep: ${pattern}`,
          output: matches.length > 0 ? matches.join('\n') : `No matches found for "${pattern}"`,
          metadata: {
            pattern,
            path: workDir,
            include,
            exclude,
            matchCount: matches.length,
            truncated: matches.length >= limit,
          },
        };
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
