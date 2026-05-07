import type { Tool, ToolContext, ExecuteResult } from './types.js'
import { sanitize } from './sanitize.js'
import { truncateOutput } from './truncate.js'

const isDev = process.env.NODE_ENV !== 'production'

function toolLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
  if (!isDev) return
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[${timestamp}] [Tool] [${level}] ${message}${metaStr}`)
}

class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      toolLog('WARN', `Tool ${tool.id} is already registered, overwriting`)
    }
    this.tools.set(tool.id, tool)
    toolLog('INFO', `Registered tool: ${tool.id}`)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  list(): Tool[] {
    return Array.from(this.tools.values())
  }

  listNames(): string[] {
    return Array.from(this.tools.keys())
  }

  async call(name: string, args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool "${name}" not found`)
    }

    const startTime = Date.now()
    toolLog('INFO', `Calling tool: ${name}`, { argsKeys: Object.keys(args as object) })

    try {
      const result = await tool.execute(args, ctx)
      const duration = Date.now() - startTime

      const sanitizedOutput = sanitize(result.output)
      const truncatedResult = truncateOutput(sanitizedOutput)

      toolLog('INFO', `Tool ${name} completed`, { duration })

      return {
        ...result,
        output: truncatedResult.content,
        metadata: {
          ...result.metadata,
          truncated: truncatedResult.truncated,
          ...(truncatedResult.truncated && truncatedResult.outputPath
            ? { outputPath: truncatedResult.outputPath }
            : {}),
        },
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      toolLog('ERROR', `Tool ${name} failed`, { duration, error: error.message })
      throw error
    }
  }
}

export const toolRegistry = new ToolRegistry()
export { toolRegistry as registry }
