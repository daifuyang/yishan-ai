import type { Tool, ToolContext } from './types.js';

interface TimeArgs {
  timezone?: string;
  format?: 'full' | 'date' | 'time' | 'iso';
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
          description:
            'Output format: "full" (local + UTC + ISO), "date" (YYYY-MM-DD), "time" (HH:mm:ss), "iso" (ISO 8601)',
          default: 'full',
        },
      },
    },
    async execute(args: unknown, _ctx: ToolContext): Promise<string> {
      const { timezone, format = 'full' } = args as TimeArgs;
      const now = new Date();

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
          });

          const parts = formatter.formatToParts(now);
          const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

          const localDate = `${get('year')}-${get('month')}-${get('day')}`;
          const localTime = `${get('hour')}:${get('minute')}:${get('second')}`;

          if (format === 'date') return localDate;
          if (format === 'time') return localTime;
          if (format === 'iso') return now.toISOString();

          return `Timezone: ${timezone}\nLocal: ${localDate} ${localTime}\nUTC: ${now.toISOString()}`;
        } catch {
          throw new Error(
            `Invalid timezone: "${timezone}". Use IANA timezone names (e.g., "Asia/Shanghai", "America/New_York")`
          );
        }
      }

      const localDate = now.toLocaleDateString('zh-CN');
      const localTime = now.toLocaleTimeString('zh-CN');

      switch (format) {
        case 'date':
          return localDate;
        case 'time':
          return localTime;
        case 'iso':
          return now.toISOString();
        default:
          return `本地时间: ${localDate} ${localTime}\nUTC 时间: ${now.toUTCString()}\nISO 时间: ${now.toISOString()}`;
      }
    },
  };
}
