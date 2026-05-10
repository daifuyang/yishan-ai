import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeFileInSandbox } from './docker-sandbox.js';
import { logPermission } from './permission-log.js';
import type { ExecuteResult, Tool, ToolContext } from './types.js';

interface WriteArgs {
  filePath: string;
  content: string;
  append?: boolean;
}

function isWithinDirectory(filePath: string, directory: string): boolean {
  const resolved = path.resolve(filePath);
  const dirResolved = path.resolve(directory);
  return resolved.startsWith(dirResolved + path.sep) || resolved === dirResolved;
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
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const { filePath, content, append = false } = args as WriteArgs;

      if (!filePath) {
        throw new Error('filePath is required');
      }

      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(ctx.directory, filePath);

      if (!isWithinDirectory(resolvedPath, ctx.directory)) {
        throw new Error(`Access denied: ${filePath} is outside workspace`);
      }

      logPermission(ctx.sessionId, 'write', { path: resolvedPath });

      try {
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        await writeFileInSandbox(resolvedPath, content, ctx.directory);

        const stat = fs.statSync(resolvedPath);

        return {
          title: path.basename(resolvedPath),
          output: `${append ? 'Appended' : 'Written'} ${Buffer.byteLength(content, 'utf8')} bytes to ${filePath}\nFile size: ${stat.size} bytes`,
          metadata: {
            path: resolvedPath,
            bytes: Buffer.byteLength(content, 'utf8'),
            append,
            fileSize: stat.size,
          },
        };
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
