import { Anthropic } from '@anthropic-ai/sdk';
import { runAgentLoop } from '../lib/agent-loop.js';
import { appendMessage } from '../stores/message-store.js';
import {
  appendStreamingContent,
  getSession,
  updateSessionStatus,
} from '../stores/session-store.js';
import type { AgentMessage, MCPTool } from '../types/agent-events.js';

interface WorkerOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  correlationId?: string;
}

interface InitData {
  sessionId: string;
  messages: AgentMessage[];
  options: WorkerOptions;
  tools: MCPTool[];
}

interface ToolResultData {
  result: string | { content?: Array<{ type: string; text?: string }>; text?: string };
}

interface ToolErrorData {
  error: string;
}

type WorkerMessage =
  | { type: 'init'; data: InitData }
  | { type: 'tool_result'; data: ToolResultData }
  | { type: 'tool_error'; data: ToolErrorData }
  | { type: 'stop' };

let sessionId: string;
let abortController: AbortController;
let pendingToolResolve: ((result: string) => void) | null = null;

const completedToolCalls: {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
}[] = [];

function log(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  message: string,
  meta?: Record<string, unknown>
) {
  process.send?.({ type: 'log', data: { level, message, meta: meta || {} } });
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'apiKey',
    'token',
    'password',
    'authorization',
    'secret',
    'MINIMAX_API_KEY',
    'path',
    'file_path',
  ];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '***';
    } else if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = `${value.slice(0, 200)}...`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function parseToolResult(
  result: string | { content?: Array<{ type: string; text?: string }>; text?: string }
): string {
  if (typeof result === 'string') return result;
  if (result.content && Array.isArray(result.content)) {
    return result.content
      .map((block) => {
        if (block.type === 'text') return block.text || '';
        if (block.type === 'image') return '[Image]';
        return JSON.stringify(block);
      })
      .join('\n');
  }
  if (result.text) return result.text;
  return JSON.stringify(result);
}

process.on('uncaughtException', (err) => {
  log('ERROR', 'Uncaught exception in worker', { error: String(err), stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', 'Unhandled rejection in worker', { reason: String(reason) });
  process.exit(1);
});

process.on('message', async (msg: WorkerMessage) => {
  if (msg.type === 'init') {
    sessionId = msg.data.sessionId;
    const messages = msg.data.messages;
    const options = msg.data.options || {};
    const tools = msg.data.tools || [];
    abortController = new AbortController();

    log('INFO', 'Worker initialized', {
      sessionId,
      toolCount: tools.length,
      messageCount: messages.length,
      model: options.model,
      correlationId: options.correlationId,
    });

    await run(messages, tools, options);
  } else if (msg.type === 'tool_result') {
    log('DEBUG', 'Received tool_result from parent');
    if (pendingToolResolve) {
      const content = parseToolResult(msg.data.result);
      pendingToolResolve(content);
      pendingToolResolve = null;
    }
  } else if (msg.type === 'tool_error') {
    log('WARN', 'Received tool_error from parent', { error: msg.data.error });
    if (pendingToolResolve) {
      pendingToolResolve(`Error: ${msg.data.error}`);
      pendingToolResolve = null;
    }
  } else if (msg.type === 'stop') {
    log('INFO', 'Received stop signal');
    abortController?.abort();
  }
});

async function run(messages: AgentMessage[], tools: MCPTool[], options: WorkerOptions) {
  const client = new Anthropic({
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
  });

  const executeTool = (name: string, args: Record<string, unknown>): Promise<string> => {
    return new Promise((resolve) => {
      pendingToolResolve = resolve;
      const sanitizedArgs = sanitizeArgs(args);
      log('INFO', 'Emitting tool_call to parent', { toolName: name, args: sanitizedArgs });
      process.send?.({ type: 'tool_call', data: { tool: name, args } });
    });
  };

  const generator = runAgentLoop({
    messages,
    tools,
    model: {
      model: options.model,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt,
    },
    signal: abortController.signal,
    executeTool,
    client,
  });

  let currentStreamingContent = '';

  try {
    for await (const event of generator) {
      switch (event.type) {
        case 'text-delta':
          currentStreamingContent += event.text;
          appendStreamingContent(sessionId, event.text);
          process.send?.({
            type: 'delta',
            data: {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: event.text },
            },
          });
          break;

        case 'tool-start':
          if (currentStreamingContent) {
            appendMessage(
              sessionId,
              'assistant',
              [{ type: 'text', text: currentStreamingContent }],
              undefined,
              []
            );
            currentStreamingContent = '';
          }
          break;

        case 'tool-done':
          completedToolCalls.push({
            id: event.toolId,
            name: event.toolName,
            input: {},
            output: event.isError ? undefined : event.result,
            error: event.isError ? event.result : undefined,
          });
          break;

        case 'error':
          log('ERROR', 'Agent loop error', { error: event.message });
          updateSessionStatus(sessionId, 'failed');
          process.send?.({ type: 'error', data: { message: event.message } });
          return;

        case 'complete':
          if (abortController.signal.aborted) {
            const session = await getSession(sessionId);
            const streamingContent = session?.streamingContent || '';
            if (streamingContent) {
              await appendMessage(
                sessionId,
                'assistant',
                [{ type: 'text', text: streamingContent }],
                undefined,
                completedToolCalls
              );
            }
          } else {
            appendMessage(
              sessionId,
              'assistant',
              [{ type: 'text', text: event.content }],
              undefined,
              completedToolCalls
            );
          }
          updateSessionStatus(sessionId, 'idle', null);
          process.send?.({ type: 'done' });
          break;
      }
    }
  } catch (err) {
    log('ERROR', 'Unexpected error consuming agent loop', { error: String(err) });
    updateSessionStatus(sessionId, 'failed');
    process.send?.({ type: 'error', data: { message: String(err) } });
  }
}
