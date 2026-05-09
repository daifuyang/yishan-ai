import type { Tool, ToolContext, ExecuteResult } from './types.js'

interface TimeArgs {
  timezone?: string
  format?: 'full' | 'date' | 'time' | 'iso'
}

export function createTimeTool(): Tool {
  return {
    id: 'get_current_time',
    description: 'Get the current system time in multiple formats',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone name (e.g., "Asia/Shanghai", "America/New_York", "Europe/London")',
        },
        format: {
          type: 'string',
          enum: ['full', 'date', 'time', 'iso'],
          description: 'Output format: "full" (local + UTC + ISO), "date" (YYYY-MM-DD), "time" (HH:mm:ss), "iso" (ISO 8601)',
          default: 'full',
        },
      },
    },
    async execute(args: unknown, _ctx: ToolContext): Promise<ExecuteResult> {
      const { timezone, format = 'full' } = args as TimeArgs
      const now = new Date()

      if (timezone) {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })

          const parts = formatter.formatToParts(now)
          const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

          const localDate = `${get('year')}-${get('month')}-${get('day')}`
          const localTime = `${get('hour')}:${get('minute')}:${get('second')}`

          if (format === 'date') {
            return { title: 'Current Date', output: localDate, metadata: { timezone, format } }
          }
          if (format === 'time') {
            return { title: 'Current Time', output: localTime, metadata: { timezone, format } }
          }
          if (format === 'iso') {
            return { title: 'ISO Time', output: now.toISOString(), metadata: { timezone, format } }
          }

          return {
            title: 'Current Time',
            output: `Timezone: ${timezone}\nLocal: ${localDate} ${localTime}\nUTC: ${now.toISOString()}`,
            metadata: { timezone, format },
          }
        } catch {
          throw new Error(`Invalid timezone: "${timezone}". Use IANA timezone names (e.g., "Asia/Shanghai", "America/New_York")`)
        }
      }

      const localDate = now.toLocaleDateString('zh-CN')
      const localTime = now.toLocaleTimeString('zh-CN')

      switch (format) {
        case 'date':
          return { title: 'Current Date', output: localDate, metadata: { format } }
        case 'time':
          return { title: 'Current Time', output: localTime, metadata: { format } }
        case 'iso':
          return { title: 'ISO Time', output: now.toISOString(), metadata: { format } }
        default:
          return {
            title: 'Current Time',
            output: `本地时间: ${localDate} ${localTime}\nUTC 时间: ${now.toUTCString()}\nISO 时间: ${now.toISOString()}`,
            metadata: { format },
          }
      }
    },
  }
}
