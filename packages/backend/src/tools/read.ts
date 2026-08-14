import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPathContained } from '../sandbox/path-check.js';
import type { Tool, ToolContext } from './types.js';

const MAX_LINE_LENGTH = 2000;
const MAX_BYTES = 50 * 1024;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;

interface ReadArgs {
  filePath: string;
  offset?: number;
  limit?: number;
}

export function createReadTool(): Tool {
  return {
    id: 'read',
    description: 'Read the contents of a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the file or directory to read',
        },
        offset: {
          type: 'number',
          description: 'The line number to start reading from (1-indexed)',
        },
        limit: {
          type: 'number',
          description: 'The maximum number of lines to read (default 2000)',
        },
      },
      required: ['filePath'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const { filePath, offset = 0, limit = 2000 } = args as ReadArgs;

      if (!filePath) {
        throw new Error('filePath is required');
      }

      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(ctx.directory, filePath);

      if (!isPathContained(resolvedPath, ctx.directory)) {
        throw new Error(`Access denied: ${filePath} is outside workspace`);
      }

      try {
        const stat = fs.statSync(resolvedPath);

        if (stat.isDirectory()) {
          const entries = fs.readdirSync(resolvedPath);
          return entries
            .map((entry) => {
              const fullPath = path.join(resolvedPath, entry);
              try {
                const entryStat = fs.statSync(fullPath);
                if (entryStat.isDirectory()) {
                  return `${entry}/`;
                }
                if (entryStat.isSymbolicLink()) {
                  return `${entry}@`;
                }
                return entry;
              } catch {
                return `${entry}?`;
              }
            })
            .join('\n');
        }

        if (!stat.isFile()) {
          throw new Error(`${filePath} is not a regular file`);
        }

        const content = fs.readFileSync(resolvedPath, 'utf8');
        let lines = content.split('\n');

        if (offset > 0) {
          lines = lines.slice(Math.min(offset, lines.length));
        }

        if (limit > 0 && lines.length > limit) {
          lines = lines.slice(0, limit);
        }

        let output = lines.join('\n');

        if (Buffer.byteLength(output, 'utf8') > MAX_BYTES) {
          let bytes = 0;
          let charCount = 0;
          for (const char of output) {
            bytes += Buffer.byteLength(char, 'utf8');
            if (bytes > MAX_BYTES) break;
            charCount++;
          }
          output = `${output.slice(0, charCount)}\n... (output truncated to byte limit)`;
        }

        const resultLines = output.split('\n');
        for (let i = 0; i < resultLines.length; i++) {
          if (resultLines[i].length > MAX_LINE_LENGTH) {
            resultLines[i] = resultLines[i].slice(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX;
          }
        }
        output = resultLines.join('\n');

        return output;
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'ENOENT') {
          throw new Error(`File not found: ${filePath}`);
        }
        if (err.code === 'EACCES') {
          throw new Error(`Permission denied: ${filePath}`);
        }
        throw error;
      }
    },
  };
}
