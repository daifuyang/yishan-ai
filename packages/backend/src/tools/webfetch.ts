import type { Tool, ToolContext, ExecuteResult } from './types.js'
import { logPermission } from './permission-log.js'

interface WebFetchArgs {
  url: string
  description?: string
}

const ALLOWED_PROTOCOLS = ['http:', 'https:']
const MAX_RESPONSE_SIZE = 1024 * 1024 // 1MB

export function createWebFetchTool(): Tool {
  return {
    id: 'webfetch',
    description: 'Fetch content from a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
        description: {
          type: 'string',
          description: 'Description of what is being fetched',
        },
      },
      required: ['url'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult> {
      const { url, description } = args as WebFetchArgs

      if (!url) {
        throw new Error('url is required')
      }

      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
      } catch {
        throw new Error(`Invalid URL: ${url}`)
      }

      if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
        throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`)
      }

      logPermission(ctx.sessionId, 'network', { path: url })

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Yishan-AI/1.0',
            'Accept': 'text/html,application/json,text/plain,*/*',
          },
        })

        clearTimeout(timeout)

        if (!response.ok) {
          return {
            title: description || url,
            output: `HTTP ${response.status} ${response.statusText}\nURL: ${url}`,
            metadata: {
              url,
              status: response.status,
              statusText: response.statusText,
            },
          }
        }

        const contentType = response.headers.get('content-type') || ''
        const text = await response.text()
        const truncated = text.length > MAX_RESPONSE_SIZE
        const output = truncated ? text.slice(0, MAX_RESPONSE_SIZE) + '\n... (truncated)' : text

        return {
          title: description || new URL(url).hostname,
          output,
          metadata: {
            url,
            contentType,
            status: response.status,
            truncated,
            originalLength: text.length,
          },
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout: ${url}`)
        }
        throw new Error(`Failed to fetch ${url}: ${error.message}`)
      }
    },
  }
}
