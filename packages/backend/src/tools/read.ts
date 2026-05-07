import * as fs from 'fs'
import * as path from 'path'
import type { Tool, ToolContext, ExecuteResult } from './types.js'
import { logPermission } from './permission-log.js'
import { readFileInSandbox } from './docker-sandbox.js'

const MAX_LINE_LENGTH = 2000
const MAX_BYTES = 50 * 1024 // 50KB
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`

interface ReadArgs {
  filePath: string
  offset?: number
  limit?: number
}

function isWithinDirectory(filePath: string, directory: string): boolean {
  const resolved = path.resolve(filePath)
  const dirResolved = path.resolve(directory)
  return resolved.startsWith(dirResolved + path.sep) || resolved === dirResolved
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
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const { filePath, offset = 0, limit = 2000 } = args as ReadArgs

      if (!filePath) {
        throw new Error('filePath is required')
      }

      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(ctx.directory, filePath)

      if (!isWithinDirectory(resolvedPath, ctx.directory)) {
        throw new Error(`Access denied: ${filePath} is outside workspace`)
      }

      logPermission(ctx.sessionId, 'read', { path: resolvedPath })

      try {
        const stat = fs.statSync(resolvedPath)

        if (stat.isDirectory()) {
          const entries = fs.readdirSync(resolvedPath)
          const formatted = entries.map(entry => {
            const fullPath = path.join(resolvedPath, entry)
            try {
              const entryStat = fs.statSync(fullPath)
              if (entryStat.isDirectory()) {
                return entry + '/'
              }
              if (entryStat.isSymbolicLink()) {
                return entry + '@'
              }
              return entry
            } catch {
              return entry + '?'
            }
          }).join('\n')

          return {
            title: path.basename(resolvedPath),
            output: formatted,
            metadata: { type: 'directory', path: resolvedPath },
          }
        }

        if (!stat.isFile()) {
          throw new Error(`${filePath} is not a regular file`)
        }

        const content = await readFileInSandbox(resolvedPath, ctx.directory)
        let lines = content.split('\n')
        const totalLines = lines.length

        if (offset > 0) {
          lines = lines.slice(Math.min(offset, lines.length))
        }

        if (limit > 0 && lines.length > limit) {
          lines = lines.slice(0, limit)
        }

        let output = lines.join('\n')

        if (Buffer.byteLength(output, 'utf8') > MAX_BYTES) {
          let bytes = 0
          let charCount = 0
          for (const char of output) {
            bytes += Buffer.byteLength(char, 'utf8')
            if (bytes > MAX_BYTES) break
            charCount++
          }
          output = output.slice(0, charCount) + '\n... (output truncated to byte limit)'
        }

        if (output.length > MAX_LINE_LENGTH * MAX_LINE_LENGTH) {
          output = output.slice(0, MAX_LINE_LENGTH * MAX_LINE_LENGTH) + '\n... (output too long)'
        }

        for (let i = 0; i < output.split('\n').length; i++) {
          const line = output.split('\n')[i]
          if (line.length > MAX_LINE_LENGTH) {
            output = output.replace(line, line.slice(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX)
          }
        }

        return {
          title: path.basename(resolvedPath),
          output,
          metadata: {
            type: 'file',
            path: resolvedPath,
            totalLines,
            readLines: offset > 0 ? `${offset}-${offset + limit}` : `1-${Math.min(limit, totalLines)}`,
          },
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`File not found: ${filePath}`)
        }
        if (error.code === 'EACCES') {
          throw new Error(`Permission denied: ${filePath}`)
        }
        throw error
      }
    },
  }
}
