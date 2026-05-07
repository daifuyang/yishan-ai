import type { Tool, ToolContext, ExecuteResult } from './types.js'
import { logPermission } from './permission-log.js'
import { globInSandbox } from './docker-sandbox.js'

interface GlobArgs {
  pattern: string
  cwd?: string
  limit?: number
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
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const { pattern, cwd, limit = 100 } = args as GlobArgs

      if (!pattern) {
        throw new Error('pattern is required')
      }

      const workDir = cwd ? ctx.directory + '/' + cwd : ctx.directory

      logPermission(ctx.sessionId, 'read', { path: workDir })

      try {
        const output = await globInSandbox(pattern, workDir)

        const lines = output.split('\n').filter(line => line.trim())
        const limited = lines.slice(0, limit)
        const resultOutput = limited.join('\n')
        const truncated = lines.length > limit

        return {
          title: `Glob: ${pattern}`,
          output: truncated ? `${resultOutput}\n... (${lines.length - limit} more results)` : resultOutput || 'No matches found',
          metadata: {
            pattern,
            cwd: workDir,
            totalMatches: lines.length,
            returned: limited.length,
            truncated,
          },
        }
      } catch (error: any) {
        throw new Error(`Glob failed: ${error.message}`)
      }
    },
  }
}
