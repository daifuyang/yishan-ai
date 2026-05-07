import * as fs from 'fs'
import * as path from 'path'
import { createTwoFilesPatch } from 'diff'
import type { Tool, ToolContext, ExecuteResult } from './types.js'
import { logPermission } from './permission-log.js'
import { readFileInSandbox, writeFileInSandbox } from './docker-sandbox.js'

interface EditArgs {
  filePath: string
  oldString: string
  newString: string
  replaceAll?: boolean
}

function isWithinDirectory(filePath: string, directory: string): boolean {
  const resolved = path.resolve(filePath)
  const dirResolved = path.resolve(directory)
  return resolved.startsWith(dirResolved + path.sep) || resolved === dirResolved
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function createEditTool(): Tool {
  return {
    id: 'edit',
    description: 'Edit a file by replacing text. The oldString must match the existing content exactly.',
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
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const { filePath, oldString, newString, replaceAll = false } = args as EditArgs

      if (!filePath) {
        throw new Error('filePath is required')
      }

      if (oldString === newString) {
        throw new Error('No changes to apply: oldString and newString are identical')
      }

      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(ctx.directory, filePath)

      if (!isWithinDirectory(resolvedPath, ctx.directory)) {
        throw new Error(`Access denied: ${filePath} is outside workspace`)
      }

      logPermission(ctx.sessionId, 'edit', { path: resolvedPath })

      try {
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${filePath}`)
        }

        const stat = fs.statSync(resolvedPath)
        if (!stat.isFile()) {
          throw new Error(`${filePath} is not a regular file`)
        }

        const content = await readFileInSandbox(resolvedPath, ctx.directory)
        let contentNormalized = normalizeLineEndings(content)
        const oldNormalized = normalizeLineEndings(oldString)
        const newNormalized = normalizeLineEndings(newString)

        if (replaceAll) {
          if (!contentNormalized.includes(oldNormalized)) {
            throw new Error(`oldString not found in ${filePath}`)
          }
          const count = (contentNormalized.match(new RegExp(escapeRegExp(oldNormalized), 'g')) || []).length
          contentNormalized = contentNormalized.split(oldNormalized).join(newNormalized)

          await writeFileInSandbox(resolvedPath, contentNormalized, ctx.directory)

          return {
            title: path.basename(resolvedPath),
            output: `Replaced ${count} occurrence(s) in ${filePath}`,
            metadata: {
              path: resolvedPath,
              occurrences: count,
              replaceAll: true,
            },
          }
        } else {
          const index = contentNormalized.indexOf(oldNormalized)
          if (index === -1) {
            throw new Error(`oldString not found in ${filePath}`)
          }

          const before = contentNormalized.slice(0, index)
          const after = contentNormalized.slice(index + oldNormalized.length)
          contentNormalized = before + newNormalized + after

          const patch = createTwoFilesPatch(
            filePath,
            filePath,
            normalizeLineEndings(oldString),
            normalizeLineEndings(newString),
            '',
            ''
          )

          await writeFileInSandbox(resolvedPath, contentNormalized, ctx.directory)

          return {
            title: path.basename(resolvedPath),
            output: `Edited ${filePath}\n${patch}`,
            metadata: {
              path: resolvedPath,
              patch,
            },
          }
        }
      } catch (error: any) {
        if (error.code === 'EACCES') {
          throw new Error(`Permission denied: ${filePath}`)
        }
        throw error
      }
    },
  }
}
