import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isPathContained } from '../sandbox/path-check.js';
import type { Tool, ToolContext } from './types.js';

const execFileAsync = promisify(execFile);

interface GlobArgs {
  pattern: string;
  cwd?: string;
  limit?: number;
}

export function createGlobTool(): Tool {
  return {
    id: 'glob',
    description: 'Find files matching a glob pattern',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match (e.g., **/*.ts, src/**/*.js)',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the search (defaults to workspace root)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 100)',
        },
      },
      required: ['pattern'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const { pattern, cwd, limit = 100 } = args as GlobArgs;

      if (!pattern) {
        throw new Error('pattern is required');
      }

      const workDir = cwd ? `${ctx.directory}/${cwd}` : ctx.directory;

      if (!isPathContained(workDir, ctx.directory)) {
        throw new Error(`Access denied: ${cwd} is outside workspace`);
      }

      try {
        const { stdout } = await execFileAsync('find', ['.', '-name', pattern], {
          cwd: workDir,
          timeout: 30000,
        });

        const lines = stdout.split('\n').filter((line) => line.trim());
        const limited = lines.slice(0, limit);
        const resultOutput = limited.join('\n');
        const truncated = lines.length > limit;

        return truncated
          ? `${resultOutput}\n... (${lines.length - limit} more results)`
          : resultOutput || 'No matches found';
      } catch (error: unknown) {
        const err = error as Error;
        throw new Error(`Glob failed: ${err.message}`);
      }
    },
  };
}
