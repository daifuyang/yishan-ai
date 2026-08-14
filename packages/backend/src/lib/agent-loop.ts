import type Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import type {
  AgentEvent,
  AgentLoopParams,
  AgentMessage,
  AgentMessageContent,
  MCPTool,
  ToolUseBlock,
} from '../types/agent-events.js';

function toAnthropicMessages(messages: AgentMessage[]): MessageParam[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role as 'user' | 'assistant', content: m.content };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content.map((block) => toAnthropicContentBlock(block)),
      };
    });
}

function toAnthropicContentBlock(block: AgentMessageContent) {
  switch (block.type) {
    case 'text':
      return { type: 'text' as const, text: block.text };
    case 'tool_use':
      return { type: 'tool_use' as const, id: block.id, name: block.name, input: block.input };
    case 'tool_result':
      return {
        type: 'tool_result' as const,
        tool_use_id: block.tool_use_id || block.id || '',
        content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
      };
  }
}

function toAnthropicTools(tools: MCPTool[]): Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: { type: 'object' as const, ...t.inputSchema },
  }));
}

export async function* runAgentLoop(params: AgentLoopParams): AsyncGenerator<AgentEvent> {
  const { messages, tools, model, signal, executeTool, client } = params;

  const conversationMessages = [...messages];

  while (true) {
    if (signal?.aborted) return;

    const result = yield* streamOneCall(
      client,
      conversationMessages,
      tools,
      model,
      signal,
      executeTool
    );

    if (result.type === 'done') {
      yield { type: 'complete', content: result.content };
      return;
    }

    if (result.type === 'error') {
      yield { type: 'error', message: result.message };
      return;
    }
  }
}

interface StreamDoneResult {
  type: 'done';
  content: string;
}

interface StreamToolResult {
  type: 'tool-used';
}

interface StreamErrorResult {
  type: 'error';
  message: string;
}

type StreamCallResult = StreamDoneResult | StreamToolResult | StreamErrorResult;

async function* streamOneCall(
  client: Anthropic,
  messages: AgentMessage[],
  tools: MCPTool[],
  model: AgentLoopParams['model'],
  signal: AbortSignal | undefined,
  executeTool: AgentLoopParams['executeTool']
): AsyncGenerator<AgentEvent, StreamCallResult> {
  const modelName = model.model || process.env.DEFAULT_MODEL || 'MiniMax-M2.7-highspeed';
  const maxTokens = model.maxTokens || 4096;
  const temperature = model.temperature ?? 1;
  const systemPrompt = model.systemPrompt || '';

  let fullContent = '';
  let pendingToolCall: { name: string; id: string } | null = null;
  const pendingToolInputById = new Map<string, string>();
  const pendingToolCallsQueue: { name: string; id: string; inputStr: string }[] = [];
  let hadToolCall = false;

  try {
    const stream = client.messages.stream({
      model: modelName,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
      tools: toAnthropicTools(tools),
    });

    for await (const event of stream) {
      if (signal?.aborted) {
        return { type: 'done', content: fullContent };
      }

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          yield { type: 'text-delta', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          if (pendingToolCall) {
            const current = pendingToolInputById.get(pendingToolCall.id) || '';
            const delta = event.delta as { type: string; partial_json?: string };
            pendingToolInputById.set(pendingToolCall.id, current + (delta.partial_json || ''));
          }
        }
      } else if (event.type === 'content_block_start') {
        const block = (event as unknown as { content_block?: ToolUseBlock }).content_block;
        if (block?.type === 'tool_use') {
          if (pendingToolCall || pendingToolCallsQueue.length > 0) {
            const currentInputStr = pendingToolInputById.get(pendingToolCall?.id || '') || '';
            pendingToolCallsQueue.push({
              name: pendingToolCall?.name || '',
              id: pendingToolCall?.id || '',
              inputStr: currentInputStr,
            });
          }
          pendingToolCall = { name: block.name, id: block.id };
          pendingToolInputById.set(block.id, '');
        }
      } else if (event.type === 'content_block_stop') {
        if (pendingToolCall) {
          const inputStr = pendingToolInputById.get(pendingToolCall.id) || '';
          if (inputStr) {
            try {
              const args = JSON.parse(inputStr) as Record<string, unknown>;
              yield {
                type: 'tool-start',
                toolId: pendingToolCall.id,
                toolName: pendingToolCall.name,
                args,
              };

              messages.push({
                role: 'assistant',
                content: [
                  {
                    type: 'tool_use',
                    id: pendingToolCall.id,
                    name: pendingToolCall.name,
                    input: args,
                  },
                ],
              });

              // TODO: support parallel tool execution — currently multiple tool calls
              // from a single response are executed serially because we await here.
              let toolResult: string;
              let isError = false;
              try {
                toolResult = await executeTool(pendingToolCall.name, args);
              } catch (err) {
                toolResult = `Error: ${String(err)}`;
                isError = true;
              }

              yield {
                type: 'tool-done',
                toolId: pendingToolCall.id,
                toolName: pendingToolCall.name,
                result: toolResult,
                isError,
              };

              messages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: pendingToolCall.id,
                    content: toolResult,
                  },
                ],
              });

              hadToolCall = true;
            } catch (e) {
              yield { type: 'error', message: `Failed to parse tool input: ${String(e)}` };
              return { type: 'error', message: `Failed to parse tool input: ${String(e)}` };
            }
          }

          const nextQueued = pendingToolCallsQueue.shift();
          if (nextQueued) {
            pendingToolCall = { name: nextQueued.name, id: nextQueued.id };
            pendingToolInputById.set(nextQueued.id, nextQueued.inputStr);
          } else {
            pendingToolCall = null;
          }
        }
      }
    }

    if (signal?.aborted) {
      return { type: 'done', content: fullContent };
    }

    if (hadToolCall) {
      return { type: 'tool-used' };
    }

    return { type: 'done', content: fullContent };
  } catch (err) {
    return { type: 'error', message: String(err) };
  }
}
