import type { Tool, ToolContext } from './types.js';

interface WebFetchArgs {
  url: string;
  description?: string;
}

const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB

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
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const { url } = args as WebFetchArgs;

      if (!url) {
        throw new Error('url is required');
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error(`Invalid URL: ${url}`);
      }

      if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
        throw new Error(
          `Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`
        );
      }

      // network access logged via sandbox

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Yishan-AI/1.0',
            Accept: 'text/html,application/json,text/plain,*/*',
          },
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return `HTTP ${response.status} ${response.statusText}\nURL: ${url}`;
        }

        const text = await response.text();
        const truncated = text.length > MAX_RESPONSE_SIZE;

        return truncated ? `${text.slice(0, MAX_RESPONSE_SIZE)}\n... (truncated)` : text;
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };
        if (err.name === 'AbortError') {
          throw new Error(`Request timeout: ${url}`);
        }
        throw new Error(`Failed to fetch ${url}: ${err.message}`);
      }
    },
  };
}
