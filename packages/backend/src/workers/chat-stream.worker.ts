import { Anthropic } from '@anthropic-ai/sdk';
import { appendStreamingContent, updateSessionStatus, getSession } from '../stores/session-store.js';
import { appendMessage } from '../stores/message-store.js';

let sessionId: string;
let messages: any[];
let options: {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  correlationId?: string;
};
let tools: any[] = [];
let pendingToolCall: { name: string; input: string; id: string } | null = null;
let completedToolCalls: { id: string; name: string; input: Record<string, unknown>; output?: unknown; error?: string }[] = [];
let isStopping = false;

function log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
  process.send?.({ type: 'log', data: { level, message, meta: meta || {} } });
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['apiKey', 'token', 'password', 'authorization', 'secret', 'MINIMAX_API_KEY', 'path', 'file_path'];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '***';
    } else if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.slice(0, 200) + '...';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

process.on('message', async (msg: { type: string; data?: any }) => {
  if (msg.type === 'init') {
    sessionId = msg.data.sessionId;
    messages = msg.data.messages;
    options = msg.data.options || {};
    tools = msg.data.tools || [];
    isStopping = false;

    log('INFO', 'Worker initialized', {
      sessionId,
      toolCount: tools.length,
      messageCount: messages.length,
      model: options.model,
      correlationId: options.correlationId,
    });

    await run();
  } else if (msg.type === 'tool_result') {
    log('DEBUG', 'Received tool_result from parent');
    handleToolResult(msg.data.result);
  } else if (msg.type === 'tool_error') {
    log('WARN', 'Received tool_error from parent', { error: msg.data.error });
    handleToolError(msg.data.error);
  } else if (msg.type === 'stop') {
    log('INFO', 'Received stop signal');
    isStopping = true;
  }
});

function finalizeToolCall(content: string) {
  if (!pendingToolCall) return;

  const { name, id, input } = pendingToolCall;
  pendingToolCall = null;

  const toolCallRecord = {
    id,
    name,
    input: JSON.parse(input),
    output: content.startsWith('Error:') ? undefined : content,
    error: content.startsWith('Error:') ? content : undefined,
  };
  completedToolCalls.push(toolCallRecord);

  log('DEBUG', 'Finalizing tool call', {
    toolId: id,
    toolName: name,
    isError: content.startsWith('Error:'),
    outputPreview: content.slice(0, 200),
  });

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
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
  log('DEBUG', 'Handling tool result', { resultLength: resultStr.length });
  finalizeToolCall(resultStr);
}

function handleToolError(error: string) {
  log('DEBUG', 'Handling tool error', { error });
  finalizeToolCall(`Error: ${error}`);
}

function handleStop() {
  log('INFO', 'Handling stop, finalizing stream');

  const session = getSession(sessionId);
  const streamingContent = session?.streamingContent || '';

  if (streamingContent) {
    appendMessage(sessionId, 'assistant', [{ type: 'text', text: streamingContent }], undefined, completedToolCalls);
  }
  updateSessionStatus(sessionId, 'idle', null);
  process.send?.({ type: 'done' });
  process.exit(0);
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

  const model = options.model || process.env.DEFAULT_MODEL || 'MiniMax-M2.7';
  const maxTokens = options.maxTokens || 4096;
  const temperature = 1;
  const systemPrompt = options.systemPrompt || '';

  log('INFO', 'API request', {
    model,
    max_tokens: maxTokens,
    temperature,
    systemPromptLength: systemPrompt.length,
    systemPromptPreview: systemPrompt.slice(0, 300),
    messageCount: messages.length,
    messages: messages.map(m => ({
      role: m.role,
      contentType: typeof m.content === 'string' ? 'text' : 'array',
      contentLength: typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length,
    })),
    toolCount: tools.length,
    tools: tools.map(t => ({ name: t.name, description: t.description?.slice(0, 100) })),
  });

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
      tools,
    });

    log('DEBUG', 'API stream created, starting to process events');

    for await (const event of stream) {
      if (isStopping) {
        log('DEBUG', 'Stop flag set, breaking from stream loop');
        handleStop();
        return;
      }

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          appendStreamingContent(sessionId, event.delta.text);
          process.send?.({ type: 'delta', data: event });
        } else if (event.delta.type === 'input_json_delta') {
          if (pendingToolCall) {
            pendingToolCall.input += (event.delta as any).partial_json;
          }
        }
      } else if (event.type === 'content_block_start') {
        if ((event as any).content_block?.type === 'tool_use') {
          const block = (event as any).content_block;
          pendingToolCall = {
            name: block?.name,
            id: block?.id,
            input: '',
          };
          log('DEBUG', 'Started tool_use block', { toolName: block?.name, toolId: block?.id });
        }
      } else if (event.type === 'content_block_stop') {
        if (pendingToolCall && pendingToolCall.input) {
          try {
            const args = JSON.parse(pendingToolCall.input);
            const sanitizedArgs = sanitizeArgs(args);
            log('INFO', 'Emitting tool_call to parent', {
              toolName: pendingToolCall.name,
              toolId: pendingToolCall.id,
              args: sanitizedArgs,
            });
            process.send?.({ type: 'tool_call', data: { tool: pendingToolCall.name, args } });
          } catch (e) {
            log('ERROR', 'Failed to parse tool input JSON', { error: String(e), input: pendingToolCall.input.slice(0, 200) });
          }
        }
      }
    }

    if (isStopping) {
      handleStop();
      return;
    }

    if (!pendingToolCall) {
      log('INFO', 'Stream completed normally', {
        fullContentLength: fullContent.length,
        fullContentPreview: fullContent.slice(0, 500),
        totalMessages: messages.length,
        toolCallsCount: completedToolCalls.length,
      });

      if (fullContent || messages.length > 0) {
        appendMessage(sessionId, 'assistant', [{ type: 'text', text: fullContent }], undefined, completedToolCalls);
      }
      updateSessionStatus(sessionId, 'idle', null);
      process.send?.({ type: 'done' });
    }
  } catch (err) {
    log('ERROR', 'API stream error', { error: String(err), errorName: (err as Error).name });
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

  const model = options.model || process.env.DEFAULT_MODEL || 'MiniMax-M2.7';
  const maxTokens = options.maxTokens || 4096;
  const temperature = 1;
  const systemPrompt = options.systemPrompt || '';

  log('INFO', 'API follow-up request', {
    model,
    max_tokens: maxTokens,
    temperature,
    systemPromptLength: systemPrompt.length,
    systemPromptPreview: systemPrompt.slice(0, 300),
    messageCount: messages.length,
    messages: messages.map(m => ({
      role: m.role,
      contentType: typeof m.content === 'string' ? 'text' : 'array',
      contentLength: typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length,
    })),
    toolCount: tools.length,
    tools: tools.map(t => ({ name: t.name, description: t.description?.slice(0, 100) })),
  });

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
      tools,
    });

    for await (const event of stream) {
      if (isStopping) {
        handleStop();
        return;
      }

      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        appendStreamingContent(sessionId, event.delta.text);
        process.send?.({ type: 'delta', data: event });
      }
    }

    if (isStopping) {
      handleStop();
      return;
    }

    log('INFO', 'Follow-up stream completed', {
      fullContentLength: fullContent.length,
      fullContentPreview: fullContent.slice(0, 500),
    });

    appendMessage(sessionId, 'assistant', [{ type: 'text', text: fullContent }], undefined, completedToolCalls);
    updateSessionStatus(sessionId, 'idle', null);
    process.send?.({ type: 'done' });
  } catch (err) {
    log('ERROR', 'Follow-up call error', { error: String(err), errorName: (err as Error).name });
    updateSessionStatus(sessionId, 'failed');
    process.send?.({ type: 'error', data: { message: String(err) } });
  }
}
