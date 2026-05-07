export interface ToolContext {
  sessionId: string
  messageId: string
  agent: string
  abort: AbortSignal
  directory: string
  worktree: string
}

export interface ExecuteResult {
  title: string
  output: string
  metadata: Record<string, unknown>
}

export interface Tool {
  id: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult>
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Tool['inputSchema']
  execute: Tool['execute']
}

export type ToolCallContext = {
  sessionId: string
  messageId: string
  agent: string
  abort: AbortSignal
  directory: string
  worktree: string
}
