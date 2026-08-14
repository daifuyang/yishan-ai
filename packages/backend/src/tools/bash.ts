import { getSessionPolicy, requestApproval } from '../approval/index.js';
import { runInSandbox } from '../sandbox/index.js';
import type { SandboxPolicy } from '../sandbox/types.js';
import type { Tool, ToolContext } from './types.js';

interface BashArgs {
  command: string;
  cwd?: string;
  description?: string;
}

export function createBashTool(): Tool {
  return {
    id: 'bash',
    description: `Execute a bash command in a sandboxed environment.
Commands are isolated via macOS sandbox-exec. Write access is restricted to the workspace directory by default.`,
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
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const { command, cwd } = args as BashArgs;

      if (!command || typeof command !== 'string') {
        throw new Error('command is required and must be a string');
      }

      const workDir = cwd || ctx.directory;

      const policy: SandboxPolicy = {
        mode: 'workspace-write',
        workspaceRoot: ctx.directory,
        sessionId: ctx.sessionId,
      };

      const sessionPolicy = getSessionPolicy(ctx.sessionId);
      if (sessionPolicy === 'ask') {
        const outcome = await requestApproval({
          sessionId: ctx.sessionId,
          action: 'exec',
          description: `Execute: ${command}`,
          detail: { command, cwd: workDir },
        });
        if (outcome !== 'allowed') {
          return `Error: Command execution was ${outcome === 'timeout' ? 'timed out' : 'denied'} by user`;
        }
      } else if (sessionPolicy === 'deny') {
        return 'Error: Command execution is denied by session policy';
      }

      const result = await runInSandbox({
        command,
        policy,
        cwd: workDir,
        timeout: 60000,
      });

      if (result.denied) {
        return `Error: Sandbox denied the operation.\nSTDERR: ${result.stderr}`;
      }

      let output = result.stdout;
      if (result.stderr) {
        output += `\nSTDERR: ${result.stderr}`;
      }

      if (result.exitCode !== 0) {
        output += `\n(exit code: ${result.exitCode})`;
      }

      return output || '(no output)';
    },
  };
}
