import type { Tool, ToolContext } from './types.js';

interface WebSearchArgs {
  query: string;
  limit?: number;
}

export function createWebSearchTool(): Tool {
  return {
    id: 'websearch',
    description: 'Search the web using DuckDuckGo',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 10)',
        },
      },
      required: ['query'],
    },
    async execute(args: unknown, ctx: ToolContext): Promise<string> {
      const { query, limit = 10 } = args as WebSearchArgs;

      if (!query) {
        throw new Error('query is required');
      }

      // network access logged via sandbox

      try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(
          `https://lite.duckduckgo.com/lite/?q=${encodedQuery}&kl=wt-wt`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Yishan-AI/1.0)',
              Accept: 'text/html',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Search failed: HTTP ${response.status}`);
        }

        const html = await response.text();

        const results: string[] = [];
        const linkRegex = /<a\s+href="([^"]+)"[^>]*>\s*([^<]+)\s*<\/a>/gi;
        const snippetRegex = /<p class="result__snippet"[^>]*>([^<]+)<\/p>/gi;

        const links: { href: string; title: string }[] = [];
        let match: RegExpExecArray | null = linkRegex.exec(html);
        while (match !== null && links.length < limit * 2) {
          const href = match[1];
          const title = match[2].trim();
          if (href && title && !href.includes('duckduckgo') && title.length > 3) {
            links.push({ href, title });
          }
          match = linkRegex.exec(html);
        }

        const snippets: string[] = [];
        match = snippetRegex.exec(html);
        while (match !== null) {
          snippets.push(match[1].replace(/<[^>]+>/g, ''));
          match = snippetRegex.exec(html);
        }

        for (let i = 0; i < Math.min(limit, links.length); i++) {
          const { href, title } = links[i];
          const snippet = snippets[i] || '';
          results.push(`${title}\n${href}${snippet ? `\n${snippet}` : ''}`);
        }

        return results.length > 0 ? results.join('\n\n') : `No results found for "${query}"`;
      } catch (error: unknown) {
        const err = error as Error;
        throw new Error(`Web search failed: ${err.message}`);
      }
    },
  };
}
