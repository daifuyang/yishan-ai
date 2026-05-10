import { EventEmitter } from 'node:events';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../generated/prisma/client.js';
import { autoTitle } from '../stores/session-store.js';
import type { ConfigSchema } from './config-manager.js';
import { configManager } from './config-manager.js';
import { getLogger } from './logger.js';
import type { MCPTool } from './mcp-manager.js';

const dbUrl = process.env.DATABASE_URL || `file:${configManager.get<string>('data.dir')}`;
const adapter = new PrismaLibSql({ url: dbUrl });
export const prisma = new PrismaClient({ adapter });

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
}

interface ToolResultBlock {
  type: 'tool_result';
  id?: string;
  tool_use_id?: string;
  content?: string | unknown;
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface FormattedMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
}

interface ApiTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface ToolCallResult {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  error?: string;
}

export interface SSEClient {
  reply: { raw: { writableEnded: boolean; write: (data: string) => void; end: () => void } };
  sessionId: string;
}

class StreamProcessor extends EventEmitter {
  private sseClients = new Map<string, Set<SSEClient>>();
  private runningTasks = new Map<string, AbortController>();
  private currentTools: MCPTool[] = [];

  private formatSSEEvent(
    event: string,
    data?:
      | string
      | { tool?: string; args?: Record<string, unknown>; description?: string; result?: string }
  ): { type: string; [key: string]: unknown } | null {
    switch (event) {
      case 'delta':
        return { type: 'content_block_delta', delta: { type: 'text_delta', text: data as string } };
      case 'tool_call':
        return {
          type: 'tool_call',
          data: data as { tool: string; args: Record<string, unknown>; description: string },
        };
      case 'tool_result':
        return { type: 'tool_result', data: data as { result: string } };
      case 'tool_error':
        return { type: 'tool_error', data: data as { result: string } };
      case 'done':
        return { type: 'message_stop' };
      case 'error':
        return { type: 'error', message: data as string };
      case 'stream_started':
        return { type: 'stream_started' };
      default:
        return null;
    }
  }

  async submitTask(params: {
    sessionId: string;
    userMessage: string;
    mode: 'plan' | 'build';
    systemPrompt: string;
    planReminder?: string;
    buildSwitch?: string;
    tools: MCPTool[];
  }): Promise<{ messageId: string; queued: boolean }> {
    const { sessionId, userMessage, mode, systemPrompt, planReminder, buildSwitch, tools } = params;

    if (this.runningTasks.has(sessionId)) {
      return { messageId: '', queued: true };
    }

    const abortController = new AbortController();
    this.runningTasks.set(sessionId, abortController);

    const messageId = crypto.randomUUID();

    await prisma.message.create({
      data: {
        id: messageId,
        sessionId,
        role: 'user',
        type: 'user',
        content: userMessage,
        mode,
      },
    });

    await autoTitle(sessionId, userMessage);

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'streaming', streamingContent: '' },
    });

    this.processTask(
      sessionId,
      mode,
      systemPrompt,
      planReminder,
      buildSwitch,
      tools,
      abortController.signal
    ).catch((err: Error) => {
      console.error(`[STREAM_PROC] Task ${sessionId} failed:`, err.message);
      let errorMessage = err.message;
      if (
        errorMessage.includes('Could not resolve authentication') ||
        errorMessage.includes('apiKey')
      ) {
        errorMessage = 'API 认证失败，请检查设置中的 API Key 是否正确';
      } else if (
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ENOTFOUND')
      ) {
        errorMessage = '网络请求失败，请检查网络连接';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = '请求超时，请重试';
      }
      this.broadcast(sessionId, 'error', errorMessage);
    });

    return { messageId, queued: false };
  }

  subscribe(
    sessionId: string,
    reply: SSEClient['reply']
  ): {
    cleanup: () => void;
    broadcast: (
      event: string,
      data?:
        | string
        | { tool?: string; args?: Record<string, unknown>; description?: string; result?: string }
    ) => void;
  } {
    const client: SSEClient = { reply, sessionId };
    const clients = this.sseClients.get(sessionId) || new Set();
    clients.add(client);
    this.sseClients.set(sessionId, clients);

    const cleanup = () => {
      clients.delete(client);
      if (clients.size === 0) {
        this.sseClients.delete(sessionId);
      }
    };

    const broadcast = (
      event: string,
      data?:
        | string
        | { tool?: string; args?: Record<string, unknown>; description?: string; result?: string }
    ) => {
      this.broadcast(sessionId, event, data);
    };

    return { cleanup, broadcast };
  }

  private broadcast(
    sessionId: string,
    event: string,
    data?:
      | string
      | { tool?: string; args?: Record<string, unknown>; description?: string; result?: string }
  ) {
    const clients = this.sseClients.get(sessionId);
    if (!clients) return;

    const formattedEvent = this.formatSSEEvent(event, data);
    if (!formattedEvent) return;

    for (const client of clients) {
      if (client.reply.raw.writableEnded) {
        clients.delete(client);
        continue;
      }

      client.reply.raw.write(`data: ${JSON.stringify(formattedEvent)}\n\n`);

      if (event === 'done' || event === 'error') {
        client.reply.raw.end();
      }
    }

    if (clients.size === 0) {
      this.sseClients.delete(sessionId);
    }
  }

  cancelTask(sessionId: string): boolean {
    const abortController = this.runningTasks.get(sessionId);
    if (!abortController) return false;

    abortController.abort();
    this.runningTasks.delete(sessionId);
    return true;
  }

  isTaskRunning(sessionId: string): boolean {
    return this.runningTasks.has(sessionId);
  }

  private async processTask(
    sessionId: string,
    mode: 'plan' | 'build',
    systemPrompt: string,
    planReminder: string | undefined,
    buildSwitch: string | undefined,
    tools: MCPTool[],
    signal: AbortSignal
  ) {
    this.currentTools = tools;
    signal.addEventListener('abort', () => {
      console.log(`[STREAM_PROC] Task ${sessionId} cancelled`);
    });

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const modelsConfig = configManager.get<ConfigSchema['models']>('models');
      const client = new Anthropic({
        apiKey: modelsConfig?.apiKey || process.env.MINIMAX_API_KEY,
        baseURL:
          modelsConfig?.baseUrl ||
          process.env.MINIMAX_BASE_URL ||
          'https://api.minimaxi.com/anthropic',
      });

      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      const model =
        session?.model ||
        modelsConfig?.defaultModel ||
        process.env.DEFAULT_MODEL ||
        'MiniMax-M2.7-highspeed';
      const log = getLogger(sessionId);

      let streamingContent = '';
      let fullContent = '';
      const toolCallsResults: ToolCallResult[] = [];
      let currentToolCall: ToolCallResult | null = null;
      let finalAssistantContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason = '';
      const totalStartTime = Date.now();
      let round = 0;

      while (true) {
        round++;
        if (signal.aborted) break;

        const toolCallsStartLength = toolCallsResults.length;

        const messages = await prisma.message.findMany({
          where: { sessionId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });

        log?.info('ROUND_START', `Round ${round} started with ${messages.length} messages`, {
          round,
          messageCount: messages.length,
        });

        const formattedMessages: FormattedMessage[] = [];
        for (const m of messages) {
          let content: string | ContentBlock[];
          if (typeof m.content === 'string') {
            try {
              content = JSON.parse(m.content) as ContentBlock[];
            } catch {
              content = m.content;
            }
          } else {
            content = m.content as ContentBlock[];
          }

          if (m.role === 'assistant' && Array.isArray(content)) {
            const textBlocks = content.filter((c): c is TextBlock => c.type === 'text');
            const toolUseBlocks = content.filter((c): c is ToolUseBlock => c.type === 'tool_use');
            const toolResultBlocks = content.filter(
              (c): c is ToolResultBlock => c.type === 'tool_result'
            );

            const textContent = textBlocks.map((c) => c.text).join('');

            if (textContent || toolUseBlocks.length > 0) {
              const assistantContent: (TextBlock | ToolUseBlock)[] = [];
              if (textContent) {
                assistantContent.push({ type: 'text', text: textContent });
              }
              for (const toolUse of toolUseBlocks) {
                const {
                  result: _result,
                  error: _error,
                  ...toolUseWithoutResult
                } = toolUse as ToolUseBlock & { result?: string; error?: string };
                assistantContent.push(toolUseWithoutResult as ToolUseBlock);
              }
              formattedMessages.push({ role: 'assistant', content: assistantContent });
            }

            for (const toolResult of toolResultBlocks) {
              formattedMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolResult.tool_use_id || toolResult.id,
                    content: toolResult.content,
                  },
                ],
              });
            }
          } else if (m.role === 'tool' && Array.isArray(content)) {
            for (const c of content) {
              if (c.type === 'tool_result') {
                formattedMessages.push({
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: c.tool_use_id || c.id,
                      content: c.content,
                    },
                  ],
                });
              }
            }
          } else {
            formattedMessages.push({ role: m.role as 'user' | 'assistant' | 'tool', content });
          }
        }

        if (round >= 2) {
          log?.info('ROUND_DEBUG', `Round ${round} has ${formattedMessages.length} messages`, {
            round,
            messageCount: formattedMessages.length,
          });
        }

        log?.info(
          'ROUND_API_REQUEST',
          `Round ${round} sending ${formattedMessages.length} messages`,
          {
            round,
            model,
            messageCount: formattedMessages.length,
            firstMessage: formattedMessages[0]
              ? typeof formattedMessages[0].content === 'string'
                ? formattedMessages[0].content.slice(0, 100)
                : JSON.stringify(formattedMessages[0].content).slice(0, 100)
              : null,
          }
        );

        const apiTools: ApiTool[] | undefined = tools?.map((t: MCPTool) => ({
          name: t.name,
          description: t.description,
          input_schema: (t.inputSchema || {}) as Record<string, unknown>,
        }));

        const wasPlanMode = messages.some((m) => m.role === 'assistant' && m.mode === 'plan');

        let effectiveSystemPrompt = systemPrompt;
        if (mode === 'plan' && !wasPlanMode && planReminder) {
          effectiveSystemPrompt += `\n\n${planReminder}`;
        } else if (mode === 'build' && wasPlanMode && buildSwitch) {
          effectiveSystemPrompt += `\n\n${buildSwitch}`;
        }

        const stream = client.messages.stream({
          model,
          max_tokens: 4096,
          temperature: 1,
          system: effectiveSystemPrompt,
          messages: formattedMessages as never,
          tools: apiTools as never,
        });

        let pendingToolCall: { name: string; input: string; id: string } | null = null;
        const pendingToolCallsQueue: {
          name: string;
          input: string;
          id: string;
          inputStr: string;
        }[] = [];
        const pendingToolInputById: Map<string, string> = new Map();
        let pendingAssistantContent = '';
        let hasToolCallsInThisRound = false;
        log?.info(
          'ROUND_VARS',
          `Round ${round} hasToolCallsInThisRound=${hasToolCallsInThisRound}`,
          { round, hasToolCallsInThisRound }
        );

        log?.debug('AI_CLIENT', 'Request', {
          model,
          round,
          messagesCount: formattedMessages.length,
          toolsCount: tools?.length || 0,
          toolsDetails: tools?.map((t: MCPTool) => ({
            name: t.name,
            hasDescription: !!t.description,
            hasInputSchema: !!t.inputSchema,
            inputSchemaType: (t.inputSchema as Record<string, unknown>)?.type,
            inputSchemaProperties: t.inputSchema ? Object.keys(t.inputSchema) : [],
          })),
          systemPromptLength: systemPrompt.length,
          systemPromptPreview:
            systemPrompt.slice(0, 100) + (systemPrompt.length > 100 ? '...' : ''),
          firstMessageRole: formattedMessages[0]?.role,
          firstMessageContent:
            typeof formattedMessages[0]?.content === 'string'
              ? formattedMessages[0]?.content?.slice(0, 50)
              : JSON.stringify(formattedMessages[0]?.content)?.slice(0, 100),
        });

        try {
          for await (const event of stream) {
            if (signal.aborted) break;

            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                pendingAssistantContent += event.delta.text;
                streamingContent += event.delta.text;

                await prisma.session
                  .update({
                    where: { id: sessionId },
                    data: { streamingContent },
                  })
                  .catch(() => {});

                this.broadcast(sessionId, 'delta', event.delta.text);
              } else if (event.delta.type === 'input_json_delta') {
                if (pendingToolCall) {
                  const current = pendingToolInputById.get(pendingToolCall.id) || '';
                  const delta = event.delta as { partial_json?: string };
                  pendingToolInputById.set(
                    pendingToolCall.id,
                    current + (delta.partial_json || '')
                  );
                }
              }
            } else if (event.type === 'content_block_start') {
              const block = (event as unknown as { content_block?: ToolUseBlock }).content_block;
              if (block?.type === 'tool_use') {
                if (pendingToolCall || pendingToolCallsQueue.length > 0) {
                  const currentInputStr =
                    pendingToolInputById.get(pendingToolCall?.id || '') ||
                    pendingToolCall?.input ||
                    '';
                  pendingToolCallsQueue.push({
                    name: pendingToolCall?.name || '',
                    id: pendingToolCall?.id || '',
                    input: pendingToolCall?.input || '',
                    inputStr: currentInputStr,
                  });
                }
                pendingToolCall = { name: block.name || '', id: block.id || '', input: '' };
                pendingToolInputById.set(block.id || '', '');
                hasToolCallsInThisRound = true;
                log?.info(
                  'TOOL_CALL_DETECTED',
                  `Round ${round} detected tool_call: ${block.name}`,
                  { round, toolName: block.name, toolId: block.id }
                );
              }
            } else if (event.type === 'message_stop') {
              const usage = (
                event as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }
              ).usage;
              const stopR = (event as unknown as { stop_reason?: string }).stop_reason;
              inputTokens = usage?.input_tokens || 0;
              outputTokens = usage?.output_tokens || 0;
              stopReason = stopR || '';
              log?.info('MESSAGE_STOP', `Round ${round} stopReason=${stopReason}`, {
                round,
                stopReason,
                inputTokens,
                outputTokens,
              });
            } else if (event.type === 'content_block_stop') {
              log?.info(
                'CBS',
                `Round ${round} content_block_stop, pendingTC=${pendingToolCall?.name || 'null'}`,
                {
                  round,
                  pendingTCName: pendingToolCall?.name,
                  pendingTCId: pendingToolCall?.id,
                  mapSize: pendingToolInputById.size,
                }
              );
              if (pendingToolCall) {
                log?.info('CBS_ENTER', `Round ${round} entering block`, { round });
                const inputStr =
                  pendingToolInputById.get(pendingToolCall.id) || pendingToolCall.input;
                log?.info('CBS_INPUT', `Round ${round} inputLen=${inputStr?.length}`, {
                  round,
                  inputLen: inputStr?.length,
                  inputPreview: inputStr?.slice(0, 100),
                });
                if (!inputStr) {
                  log?.info('CBS_SKIP', `Round ${round} inputStr empty`, { round });
                }
                if (inputStr) {
                  log?.info('CBS_PARSE', `Round ${round} parsing JSON`, { round });
                  const pendingTC = pendingToolCall;
                  try {
                    const args = JSON.parse(inputStr) as Record<string, unknown>;
                    log?.info('CBS_CALL', `Round ${round} calling ${pendingTC?.name}`, {
                      round,
                      toolName: pendingTC?.name,
                      args,
                    });

                    const toolName = pendingTC?.name || '';
                    const toolDescription = this.currentTools.find(
                      (t) => t.name === toolName
                    )?.description;
                    const description = (args.description as string | undefined) || toolDescription;
                    this.broadcast(sessionId, 'tool_call', { tool: toolName, args, description });

                    const toolId = pendingTC?.id || '';
                    log?.info('CBS_AWAIT', `Round ${round} before await`, { round, toolName });

                    let result:
                      | { content?: Array<{ type: string; text?: string }>; text?: string }
                      | undefined;
                    let toolError: string | undefined;
                    try {
                      result = (await this.callTool(toolName, args)) as {
                        content?: Array<{ type: string; text?: string }>;
                        text?: string;
                      };
                      log?.info('CBS_RESULT', `Round ${round} got result`, {
                        round,
                        resultType: typeof result,
                      });
                    } catch (toolErr: unknown) {
                      const err = toolErr as Error;
                      log?.error(
                        'CBS_TOOL_ERR',
                        `Round ${round} tool call failed: ${err.message}`,
                        err
                      );
                      toolError = err.message;
                    }

                    let content: string;
                    if (toolError) {
                      content = toolError;
                    } else if (typeof result === 'string') {
                      content = result;
                    } else if (result?.content && Array.isArray(result.content)) {
                      content = result.content
                        .map((block) => {
                          if (block.type === 'text') return block.text || '';
                          if (block.type === 'image') return '[Image]';
                          return JSON.stringify(block);
                        })
                        .join('\n');
                    } else if (result?.text) {
                      content = result.text;
                    } else {
                      content = JSON.stringify(result);
                    }

                    const isError = content.startsWith('Error:') || !!toolError;
                    this.broadcast(sessionId, isError ? 'tool_error' : 'tool_result', {
                      result: content,
                    });

                    currentToolCall = {
                      id: toolId,
                      name: toolName,
                      input: args,
                      result: isError ? undefined : content,
                      error: isError ? content : undefined,
                    };
                    log?.info(
                      'CBS_CURRENT',
                      `Round ${round} currentToolCall set isError=${isError}`,
                      { round, hasCurrentToolCall: !!currentToolCall, isError }
                    );

                    const nextQueued = pendingToolCallsQueue.shift();
                    if (nextQueued) {
                      pendingToolCall = { name: nextQueued.name, id: nextQueued.id, input: '' };
                      pendingToolInputById.set(nextQueued.id, nextQueued.inputStr);
                    } else {
                      pendingToolCall = null;
                    }
                  } catch (parseErr: unknown) {
                    const err = parseErr as Error;
                    log?.error(
                      'CBS_PARSE_ERR',
                      `Round ${round} JSON parse error: ${err.message}`,
                      err
                    );
                    const errorContent = `JSON parse error: ${err.message}`;
                    this.broadcast(sessionId, 'tool_error', { result: errorContent });
                    const failedToolCall = pendingTC as { id: string; name: string; input: string };
                    currentToolCall = {
                      id: failedToolCall.id,
                      name: failedToolCall.name,
                      input: { _raw: inputStr },
                      result: undefined,
                      error: errorContent,
                    };
                    log?.info(
                      'CBS_CURRENT',
                      `Round ${round} currentToolCall set isError=true (parse failed)`,
                      { round, hasCurrentToolCall: !!currentToolCall, isError: true }
                    );

                    const nextQueued = pendingToolCallsQueue.shift();
                    if (nextQueued) {
                      pendingToolCall = { name: nextQueued.name, id: nextQueued.id, input: '' };
                      pendingToolInputById.set(nextQueued.id, nextQueued.inputStr);
                    } else {
                      pendingToolCall = null;
                    }
                  }
                }
              }
            }
          }
        } catch (err: unknown) {
          const error = err as Error;
          log?.error('STREAM_DEBUG', `Stream error in round ${round}: ${error.message}`, error);
          console.error(
            `[STREAM_PROC] Stream error in round ${round}: ${error.name}: ${error.message}`,
            error.stack
          );
          throw err;
        }

        if (signal.aborted) break;

        if (currentToolCall) {
          toolCallsResults.push(currentToolCall);
          currentToolCall = null;
        }

        log?.info(
          'BREAK_CHECK',
          `Round ${round} hasToolCalls=${hasToolCallsInThisRound} contentLen=${pendingAssistantContent.length}`,
          { round, hasToolCallsInThisRound, pendingContentLength: pendingAssistantContent.length }
        );

        if (!hasToolCallsInThisRound) {
          finalAssistantContent = pendingAssistantContent;
          if (pendingAssistantContent) {
            await prisma.message
              .create({
                data: {
                  id: crypto.randomUUID(),
                  sessionId,
                  role: 'assistant',
                  type: 'final',
                  content: pendingAssistantContent,
                  mode,
                },
              })
              .catch((e: Error) => {
                console.error('[DB_ERROR] Failed to save final assistant text:', e.message);
                log?.error(
                  'DB_SAVE_FAILED',
                  `Failed to save final assistant text: ${e.message}`,
                  e
                );
              });
          }
          log?.info('LOOP_EXIT', `Round ${round} exiting loop - no tool calls`, {
            round,
            reason: 'no tool calls',
          });
          break;
        }

        const newToolCalls = toolCallsResults.slice(toolCallsStartLength);
        log?.debug(
          'STREAM_DEBUG',
          `Round ${round} completed, saving ${newToolCalls.length} new tool calls`
        );

        if (newToolCalls.length > 0) {
          const toolUseBlocks = newToolCalls.map((tc) => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            input: tc.input,
          }));

          const toolResultBlocks = newToolCalls.map((tc) => ({
            type: 'tool_result' as const,
            tool_use_id: tc.id,
            content: tc.error || tc.result || '',
          }));

          await prisma.message
            .create({
              data: {
                id: crypto.randomUUID(),
                sessionId,
                role: 'assistant',
                type: 'final',
                content: JSON.stringify(toolUseBlocks),
                mode,
              },
            })
            .catch((e: Error) => {
              console.error('[DB_ERROR] Failed to save assistant message:', e.message);
              log?.error('DB_SAVE_FAILED', `Failed to save assistant message: ${e.message}`, e);
            });

          await prisma.message
            .create({
              data: {
                id: crypto.randomUUID(),
                sessionId,
                role: 'tool',
                type: 'tool_result',
                content: JSON.stringify(toolResultBlocks),
              },
            })
            .catch((e: Error) => {
              console.error('[DB_ERROR] Failed to save tool result message:', e.message);
              log?.error('DB_SAVE_FAILED', `Failed to save tool result message: ${e.message}`, e);
            });
        }

        pendingAssistantContent = '';
      }

      fullContent = finalAssistantContent;

      const duration = Date.now() - totalStartTime;

      log?.debug('AI_CLIENT', 'Response', {
        duration,
        inputTokens,
        outputTokens,
        stopReason,
        assistantContentLength: fullContent.length,
        assistantContentPreview:
          fullContent.slice(0, 200) + (fullContent.length > 200 ? '...' : ''),
        toolCallsCount: toolCallsResults.length,
        toolCalls: toolCallsResults.map((tc) => ({
          name: tc.name,
          resultLength: tc.result?.length || 0,
        })),
      });

      if (signal.aborted) {
        await prisma.session
          .update({
            where: { id: sessionId },
            data: { status: 'idle' },
          })
          .catch(() => {});
        this.broadcast(sessionId, 'error', 'Task cancelled');
        return;
      }

      await prisma.session
        .update({
          where: { id: sessionId },
          data: { status: 'completed', streamingContent: null },
        })
        .catch(() => {});

      console.log(
        `[STREAM_PROC] Session ${sessionId} completed, content length: ${fullContent.length}, tool calls: ${toolCallsResults.length}`
      );
      this.broadcast(sessionId, 'done');
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError' || signal.aborted) {
        console.log(`[STREAM_PROC] Session ${sessionId} cancelled`);
        this.broadcast(sessionId, 'error', '任务已取消');
      } else {
        console.error(`[STREAM_PROC] Session ${sessionId} failed:`, err);

        let errorMessage = error.message;
        if (
          errorMessage.includes('Could not resolve authentication') ||
          errorMessage.includes('apiKey')
        ) {
          errorMessage = 'API 认证失败，请检查设置中的 API Key 是否正确';
        } else if (
          errorMessage.includes('fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('ENOTFOUND')
        ) {
          errorMessage = '网络请求失败，请检查网络连接';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = '请求超时，请重试';
        }

        await prisma.session
          .update({
            where: { id: sessionId },
            data: { status: 'failed', streamingContent: null },
          })
          .catch(() => {});
        this.broadcast(sessionId, 'error', errorMessage);
      }
    } finally {
      this.runningTasks.delete(sessionId);
    }
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const directories = configManager.get<string[]>('workspace.directories');
    const directory = directories?.[0] || process.cwd();

    try {
      const { toolRegistry } = await import('../tools/index.js');

      if (toolRegistry.has(name)) {
        const result = await toolRegistry.call(name, args, {
          sessionId: '',
          messageId: '',
          agent: '',
          abort: new AbortController().signal,
          directory,
          worktree: directory,
        });

        return {
          content: [{ type: 'text', text: result.output }],
          isError: false,
        };
      }
    } catch (err) {
      console.log(
        `[STREAM_PROC] Built-in tool ${name} not found or failed, falling back to MCP:`,
        err
      );
    }

    const { getMcpManager } = await import('./mcp-manager.js');
    const mcpManager = getMcpManager();
    return mcpManager.callTool(name, args);
  }
}

export const streamProcessor = new StreamProcessor();
