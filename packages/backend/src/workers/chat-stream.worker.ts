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
let tools: any[] = [];
let pendingToolCall: { name: string; input: string; id: string } | null = null;

process.on('message', async (msg: { type: string; data?: any }) => {
  if (msg.type === 'init') {
    sessionId = msg.data.sessionId;
    messages = msg.data.messages;
    options = msg.data.options || {};
    tools = msg.data.tools || [];

    // Use process.send to send debug message back to parent
    process.send?.({ type: 'debug', data: { message: 'worker_init', sessionId, toolsCount: tools.length } });

    await run();
  } else if (msg.type === 'tool_result') {
    console.error('[WORKER] tool_result received');
    // Received tool execution result from main process
    handleToolResult(msg.data.result);
  } else if (msg.type === 'tool_error') {
    console.error('[WORKER] tool_error:', msg.data.error);
    handleToolError(msg.data.error);
  }
});

function finalizeToolCall(content: string) {
  if (!pendingToolCall) return;

  const { name, id, input } = pendingToolCall;
  pendingToolCall = null;

  messages.push({
    role: 'assistant',
    content: [{
      type: 'tool_use',
      id,
      name,
      input: JSON.parse(input),
    }],
  });

  messages.push({
    role: 'user',
    content: [{
      type: 'tool_result',
      tool_use_id: id,
      content,
    }],
  });

  makeFollowUpCall();
}

function handleToolResult(result: any) {
  finalizeToolCall(typeof result === 'string' ? result : JSON.stringify(result));
}

function handleToolError(error: string) {
  finalizeToolCall(`Error: ${error}`);
}

async function run() {
  await makeApiCall();
}

async function makeApiCall() {
  const client = new Anthropic({
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic/',
  });

  let fullContent = '';

  try {
    process.send?.({ type: 'debug', data: { message: 'makeApiCall_start', toolsCount: tools.length, tools: JSON.stringify(tools).slice(0, 500) } });

    const stream = client.messages.stream({
      model: options.model || process.env.DEFAULT_MODEL || 'MiniMax-M2.7',
      max_tokens: options.maxTokens || 4096,
      temperature: 1,
      system: options.systemPrompt,
      messages,
      tools,
    });

    process.send?.({ type: 'debug', data: { message: 'makeApiCall_stream_created' } });

    for await (const event of stream) {
      console.error('[DEBUG] event type:', event.type, (event as any).content_block?.type || (event as any).delta?.type);

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          appendStreamingContent(sessionId, event.delta.text);
          process.send?.({ type: 'delta', data: event });
        } else if (event.delta.type === 'input_json_delta') {
          // Accumulate JSON for tool arguments
          console.error('[DEBUG] tool input_json_delta:', event.delta.partial_json);
          if (pendingToolCall) {
            pendingToolCall.input += (event.delta as any).partial_json;
          }
        }
      } else if (event.type === 'content_block_start') {
        console.error('[DEBUG] content_block_start type:', (event as any).content_block?.type);
        if ((event as any).content_block?.type === 'tool_use') {
          const block = (event as any).content_block;
          console.error('[DEBUG] tool_use detected:', block?.name, 'id:', block?.id);
          pendingToolCall = {
            name: block?.name,
            id: block?.id,
            input: '',
          };
        }
      } else if (event.type === 'content_block_stop') {
        if (pendingToolCall && pendingToolCall.input) {
          console.error('[DEBUG] sending tool_call:', pendingToolCall.name, pendingToolCall.input);
          process.send?.({ type: 'tool_call', data: { tool: pendingToolCall.name, args: JSON.parse(pendingToolCall.input) } });
        }
      } else if (event.type === 'message_delta') {
        // End of message
      }
    }

    console.error('[DEBUG] stream ended, pendingToolCall:', pendingToolCall);

    // If we had a tool call, the result will come via IPC
    // If we didn't have a tool call (pendingToolCall is null), we have the final response
    if (!pendingToolCall) {
      if (fullContent || messages.length > 0) {
        appendMessage(sessionId, 'assistant', [{ type: 'text', text: fullContent }]);
      }
      updateSessionStatus(sessionId, 'idle', null);
      process.send?.({ type: 'done' });
    }
    // If pendingToolCall is not null, we'll handle it when the result comes back
  } catch (err) {
    console.error('Stream error:', err);
    updateSessionStatus(sessionId, 'failed');
    process.send?.({ type: 'error', data: { message: String(err) } });
  }
}

async function makeFollowUpCall() {
  const client = new Anthropic({
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic/',
  });

  let fullContent = '';

  try {
    console.error('[DEBUG] makeFollowUpCall started, messages count:', messages.length);
    const stream = client.messages.stream({
      model: options.model || process.env.DEFAULT_MODEL || 'MiniMax-M2.7',
      max_tokens: options.maxTokens || 4096,
      temperature: 1,
      system: options.systemPrompt,
      messages,
      tools,
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
    console.error('Follow-up call error:', err);
    updateSessionStatus(sessionId, 'failed');
    process.send?.({ type: 'error', data: { message: String(err) } });
  }
}
