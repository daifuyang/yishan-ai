import { Anthropic } from '@anthropic-ai/sdk';
import { appendStreamingContent, updateSessionStatus } from '../stores/session-store.js';
import { appendMessage } from '../stores/message-store.js';

let sessionId: string;
let messages: any[];
let options: {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
};

process.on('message', async (msg: { type: string; data: any }) => {
  if (msg.type === 'init') {
    sessionId = msg.data.sessionId;
    messages = msg.data.messages;
    options = msg.data.options || {};

    await run();
  }
});

async function run() {
  const client = new Anthropic({
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic/',
  });

  let fullContent = '';

  try {
    const stream = client.messages.stream({
      model: options.model || process.env.DEFAULT_MODEL || 'MiniMax-M2.7',
      max_tokens: options.maxTokens || 4096,
      temperature: 1,
      system: options.systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        appendStreamingContent(sessionId, event.delta.text);
        process.send?.({ type: 'delta', data: event });
      } else if (event.type === 'content_block_start') {
        process.send?.({ type: 'content_block_start', data: event.content_block });
      }
    }

    appendMessage(sessionId, 'assistant', [{ type: 'text', text: fullContent }]);
    updateSessionStatus(sessionId, 'idle', null);
    process.send?.({ type: 'done' });
  } catch (err) {
    updateSessionStatus(sessionId, 'failed');
    process.send?.({ type: 'error', data: { message: String(err) } });
  }
}