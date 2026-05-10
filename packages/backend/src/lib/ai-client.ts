import { Anthropic } from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic/v1',
});

const defaultModel = process.env.DEFAULT_MODEL || 'MiniMax-M2.7';

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function chat(messages: unknown[], options: ChatOptions) {
  return client.messages.create({
    model: options.model || defaultModel,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 1,
    system: options.systemPrompt,
    messages: messages as never,
  });
}

export async function* chatStream(messages: unknown[], options: ChatOptions) {
  const stream = client.messages.stream({
    model: options.model || defaultModel,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 1,
    system: options.systemPrompt,
    messages: messages as never,
  });

  for await (const event of stream) {
    yield event;
  }
}

export { client, defaultModel };
