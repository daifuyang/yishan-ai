import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPathContained } from '../sandbox/path-check.js';
import type { Tool, ToolContext } from './types.js';

interface WriteArgs {
  filePath: string;
  content: string;
  append?: boolean;
}

export function createWriteTool(): Tool {
  return {
    id: 'write',
    description: 'Write content to a file. Creates the file if it does not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
        append: {
          type: 'boolean',
          description: 'Append to existing file instead of overwriting (default false)',
        },
      },
      required: ['filePath', 'content'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const { filePath, content, append = false } = args as WriteArgs;

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
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        if (append) {
          fs.appendFileSync(resolvedPath, content, 'utf8');
        } else {
          fs.writeFileSync(resolvedPath, content, 'utf8');
        }

        const stat = fs.statSync(resolvedPath);

        return `${append ? 'Appended' : 'Written'} ${Buffer.byteLength(content, 'utf8')} bytes to ${filePath}\nFile size: ${stat.size} bytes`;
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'EACCES') {
          throw new Error(`Permission denied: ${filePath}`);
        }
        if (err.code === 'ENOSPC') {
          throw new Error(`No space left on device: ${filePath}`);
        }
        throw error;
      }
    },
  };
}
