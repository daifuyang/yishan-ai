import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { isPathContained } from '../sandbox/path-check.js';
import type { Tool, ToolContext } from './types.js';

interface EditArgs {
  filePath: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createEditTool(): Tool {
  return {
    id: 'edit',
    description:
      'Edit a file by replacing text. The oldString must match the existing content exactly.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the file to edit',
        },
        oldString: {
          type: 'string',
          description: 'The text to replace',
        },
        newString: {
          type: 'string',
          description: 'The replacement text',
        },
        replaceAll: {
          type: 'boolean',
          description: 'Replace all occurrences of oldString (default false)',
        },
      },
      required: ['filePath', 'oldString', 'newString'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const { filePath, oldString, newString, replaceAll = false } = args as EditArgs;

      if (!filePath) {
        throw new Error('filePath is required');
      }

      if (oldString === newString) {
        throw new Error('No changes to apply: oldString and newString are identical');
      }

      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(ctx.directory, filePath);

      if (!isPathContained(resolvedPath, ctx.directory)) {
        throw new Error(`Access denied: ${filePath} is outside workspace`);
      }

      try {
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
          throw new Error(`${filePath} is not a regular file`);
        }

        const content = fs.readFileSync(resolvedPath, 'utf8');
        let contentNormalized = normalizeLineEndings(content);
        const oldNormalized = normalizeLineEndings(oldString);
        const newNormalized = normalizeLineEndings(newString);

        if (replaceAll) {
          if (!contentNormalized.includes(oldNormalized)) {
            throw new Error(`oldString not found in ${filePath}`);
          }
          const count = (
            contentNormalized.match(new RegExp(escapeRegExp(oldNormalized), 'g')) || []
          ).length;
          contentNormalized = contentNormalized.split(oldNormalized).join(newNormalized);

          fs.writeFileSync(resolvedPath, contentNormalized, 'utf8');

          return `Replaced ${count} occurrence(s) in ${filePath}`;
        }

        const index = contentNormalized.indexOf(oldNormalized);
        if (index === -1) {
          throw new Error(`oldString not found in ${filePath}`);
        }

        const before = contentNormalized.slice(0, index);
        const after = contentNormalized.slice(index + oldNormalized.length);
        contentNormalized = before + newNormalized + after;

        const patch = createTwoFilesPatch(
          filePath,
          filePath,
          normalizeLineEndings(oldString),
          normalizeLineEndings(newString),
          '',
          ''
        );

        fs.writeFileSync(resolvedPath, contentNormalized, 'utf8');

        return `Edited ${filePath}\n${patch}`;
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'EACCES') {
          throw new Error(`Permission denied: ${filePath}`);
        }
        throw error;
      }
    },
  };
}
