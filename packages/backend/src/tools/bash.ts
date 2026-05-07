import type { Tool, ToolContext, ExecuteResult } from './types.js'
import { logPermission } from './permission-log.js'
import { runInSandbox, stripAnsi } from './docker-sandbox.js'

const DANGEROUS_COMMANDS = new Set([
  'rm -rf /',
  'rm -rf /*',
  'mkfs',
  'dd if=',
  ':(){:|:&};:', // fork bomb
  '> /dev/sda',
  'mv / /dev/null',
])

function isDangerousCommand(command: string): boolean {
  const lower = command.toLowerCase().trim()
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (lower.includes(dangerous)) {
      return true
    }
  }
  return false
}

interface BashArgs {
  command: string
  cwd?: string
  description?: string
}

export function createBashTool(): Tool {
  return {
    id: 'bash',
    description: `Execute a bash command and return the output.
All paths are validated against workspace directories.`,
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command',
        },
        description: {
          type: 'string',
          description: 'Clear, concise description of the command purpose',
        },
      },
      required: ['command'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const { command, cwd, description } = args as BashArgs

      if (!command || typeof command !== 'string') {
        throw new Error('command is required and must be a string')
      }

      const workDir = cwd || ctx.directory

      logPermission(ctx.sessionId, 'exec', {
        command,
        path: workDir,
      })

      if (isDangerousCommand(command)) {
        return {
          title: description || 'Shell command',
          output: 'Error: Potentially dangerous command blocked',
          metadata: { blocked: true },
        }
      }

      const timeout = 60000

      try {
        const { stdout, stderr } = await runInSandbox({
          command,
          workDir,
          timeout,
        })

        let output = stripAnsi(stdout)
        if (stderr) {
          output += '\nSTDERR: ' + stripAnsi(stderr)
        }

        return {
          title: description || 'Shell command',
          output: output || '(no output)',
          metadata: {
            command,
            cwd: workDir,
            exitCode: 0,
          },
        }
      } catch (error: any) {
        let output = error.stdout ? stripAnsi(error.stdout) : ''
        output += '\nSTDERR: ' + (error.stderr ? stripAnsi(error.stderr) : error.message)

        return {
          title: description || 'Shell command',
          output: output || `Error: ${error.message}`,
          metadata: {
            command,
            cwd: workDir,
            exitCode: error.code || 1,
            killed: error.killed,
            signal: error.signal,
          },
        }
      }
    },
  }
}
