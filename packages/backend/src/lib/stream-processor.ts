import { EventEmitter } from 'events';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../generated/prisma/client.js';
import { getLogger } from './logger.js';
import { configManager } from './config-manager.js';
import { autoTitle } from '../stores/session-store.js';

const dbUrl = process.env.DATABASE_URL || `file:${configManager.get<string>('data.dir')}`;
const adapter = new PrismaLibSql({ url: dbUrl });
export const prisma = new PrismaClient({ adapter });

export interface SSEClient {
  reply: any;
  sessionId: string;
}

interface ToolCallResult {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  error?: string;
}

class StreamProcessor extends EventEmitter {
  private sseClients = new Map<string, Set<SSEClient>>();
  private runningTasks = new Map<string, AbortController>();

  constructor() {
    super();
  }

  private formatSSEEvent(event: string, data?: any): any {
    switch (event) {
      case 'delta':
        return { type: 'content_block_delta', delta: { type: 'text_delta', text: data } };
      case 'tool_call':
        return { type: 'tool_call', data };
      case 'tool_result':
        return { type: 'tool_result', data };
      case 'tool_error':
        return { type: 'tool_error', data };
      case 'done':
        return { type: 'message_stop' };
      case 'error':
        return { type: 'error', message: data };
      case 'stream_started':
        return { type: 'stream_started' };
      default:
        return null;
    }
  }

  async submitTask(params: {
    sessionId: string;
    userMessage: string;
    systemPrompt: string;
    tools: any[];
  }): Promise<{ messageId: string; queued: boolean }> {
    const { sessionId, userMessage, systemPrompt, tools } = params;

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
      },
    });

    await autoTitle(sessionId, userMessage);

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'streaming', streamingContent: '' },
    });

    this.processTask(sessionId, systemPrompt, tools, abortController.signal).catch((err) => {
      console.error(`[STREAM_PROC] Task ${sessionId} failed:`, err.message);
      let errorMessage = err.message;
      if (errorMessage.includes('Could not resolve authentication') || errorMessage.includes('apiKey')) {
        errorMessage = 'API 认证失败，请检查设置中的 API Key 是否正确';
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
        errorMessage = '网络请求失败，请检查网络连接';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = '请求超时，请重试';
      }
      this.broadcast(sessionId, 'error', errorMessage);
    });

    return { messageId, queued: false };
  }

  subscribe(sessionId: string, reply: any): { cleanup: () => void; broadcast: (event: string, data?: any) => void } {
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

    const broadcast = (event: string, data?: any) => {
      this.broadcast(sessionId, event, data);
    };

    return { cleanup, broadcast };
  }

  private broadcast(sessionId: string, event: string, data?: any) {
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

  private async processTask(sessionId: string, systemPrompt: string, tools: any[], signal: AbortSignal) {
    signal.addEventListener('abort', () => {
      console.log(`[STREAM_PROC] Task ${sessionId} cancelled`);
    });

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const modelsConfig = configManager.get('models');
      const client = new Anthropic({
        apiKey: modelsConfig?.apiKey || process.env.MINIMAX_API_KEY,
        baseURL: modelsConfig?.baseUrl || process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
      });

      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      const model = session?.model || modelsConfig?.defaultModel || process.env.DEFAULT_MODEL || 'MiniMax-M2.7-highspeed';
      const log = getLogger(sessionId);

      let fullContent = '';
      let streamingContent = '';
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

        const formattedMessages: any[] = [];
        for (const m of messages) {
          let content;
          if (typeof m.content === 'string') {
            try {
              content = JSON.parse(m.content);
            } catch {
              content = m.content;
            }
          } else {
            content = m.content;
          }

          if (m.role === 'assistant' && Array.isArray(content)) {
            const textContent = content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('');

            const toolUseBlocks = content.filter((c: any) => c.type === 'tool_use');
            const toolResultBlocks = content.filter((c: any) => c.type === 'tool_result');

            if (textContent || toolUseBlocks.length > 0) {
              const assistantContent: any[] = [];
              if (textContent) {
                assistantContent.push({ type: 'text', text: textContent });
              }
              for (const toolUse of toolUseBlocks) {
                const { result, error, ...toolUseWithoutResult } = toolUse;
                assistantContent.push(toolUseWithoutResult);
              }
              formattedMessages.push({ role: 'assistant', content: assistantContent });
            }

            for (const toolResult of toolResultBlocks) {
              formattedMessages.push({
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolResult.tool_use_id || toolResult.id,
                  content: toolResult.content,
                }],
              });
            }
          } else if (m.role === 'tool' && Array.isArray(content)) {
            for (const c of content) {
              if (c.type === 'tool_result') {
                formattedMessages.push({
                  role: 'user',
                  content: [{
                    type: 'tool_result',
                    tool_use_id: c.tool_use_id || c.id,
                    content: c.content,
                  }],
                });
              }
            }
          } else {
            formattedMessages.push({ role: m.role, content });
          }
        }

        if (round >= 2) {
          console.log(`[DEBUG] Round ${round} messages:`, JSON.stringify(formattedMessages, null, 2).slice(0, 2000));
        }

        const stream = client.messages.stream({
          model,
          max_tokens: 4096,
          temperature: 1,
          system: systemPrompt,
          messages: formattedMessages,
          tools,
        });

        let pendingToolCall: { name: string; input: string; id: string } | null = null;
        let pendingToolCallsQueue: { name: string; input: string; id: string; inputStr: string }[] = [];
        let pendingToolInputById: Map<string, string> = new Map();
        let pendingAssistantContent = '';
        let hasToolCallsInThisRound = false;

        // @ts-ignore - TypeScript doesn't track assignments inside async generator
        log?.debug('AI_CLIENT', 'Request', {
          model,
          round,
          messagesCount: formattedMessages.length,
          toolsCount: tools?.length || 0,
          systemPromptLength: systemPrompt.length,
          systemPromptPreview: systemPrompt.slice(0, 100) + (systemPrompt.length > 100 ? '...' : ''),
          firstMessageRole: formattedMessages[0]?.role,
          firstMessageContent: typeof formattedMessages[0]?.content === 'string' ? formattedMessages[0]?.content?.slice(0, 50) : JSON.stringify(formattedMessages[0]?.content)?.slice(0, 100),
        });

        try {
          for await (const event of stream) {
            if (signal.aborted) break;

            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                pendingAssistantContent += event.delta.text;
                streamingContent += event.delta.text;

                await prisma.session.update({
                  where: { id: sessionId },
                  data: { streamingContent },
                }).catch(() => {});

                this.broadcast(sessionId, 'delta', event.delta.text);
              } else if (event.delta.type === 'input_json_delta') {
                if (pendingToolCall) {
                  const current = pendingToolInputById.get(pendingToolCall.id) || '';
                  pendingToolInputById.set(pendingToolCall.id, current + (event.delta as any).partial_json);
                }
              }
            } else if (event.type === 'content_block_start') {
              if ((event as any).content_block?.type === 'tool_use') {
                const block = (event as any).content_block;
                if (pendingToolCall || pendingToolCallsQueue.length > 0) {
                  const currentInputStr = pendingToolInputById.get(pendingToolCall?.id || '') || pendingToolCall?.input || '';
                  pendingToolCallsQueue.push({
                    name: pendingToolCall?.name || '',
                    id: pendingToolCall?.id || '',
                    input: pendingToolCall?.input || '',
                    inputStr: currentInputStr,
                  });
                }
                pendingToolCall = { name: block?.name, id: block?.id, input: '' };
                pendingToolInputById.set(block?.id, '');
                hasToolCallsInThisRound = true;
              }
            } else if (event.type === 'message_stop') {
              inputTokens = (event as any).usage?.input_tokens || 0;
              outputTokens = (event as any).usage?.output_tokens || 0;
              stopReason = (event as any).stop_reason || '';
            } else if (event.type === 'content_block_stop') {
              if (pendingToolCall) {
                const inputStr = pendingToolInputById.get(pendingToolCall.id) || pendingToolCall.input;
                if (inputStr) {
                  try {
                    const args = JSON.parse(inputStr);

                    this.broadcast(sessionId, 'tool_call', { tool: pendingToolCall.name, args });

                    const result = await this.callTool(pendingToolCall.name, args);

                    let content: string;
                    if (typeof result === 'string') {
                      content = result;
                    } else if (result.content && Array.isArray(result.content)) {
                      content = result.content.map((block: any) => {
                        if (block.type === 'text') return block.text;
                        if (block.type === 'image') return `[Image]`;
                        return JSON.stringify(block);
                      }).join('\n');
                    } else if (result.text) {
                      content = result.text;
                    } else {
                      content = JSON.stringify(result);
                    }

                    const isError = content.startsWith('Error:');
                    this.broadcast(sessionId, isError ? 'tool_error' : 'tool_result', { result: content });

                    currentToolCall = {
                      id: pendingToolCall.id,
                      name: pendingToolCall.name,
                      input: args,
                      result: isError ? undefined : content,
                      error: isError ? content : undefined,
                    };

                    const nextQueued = pendingToolCallsQueue.shift();
                    if (nextQueued) {
                      pendingToolCall = { name: nextQueued.name, id: nextQueued.id, input: '' };
                      pendingToolInputById.set(nextQueued.id, nextQueued.inputStr);
                    } else {
                      pendingToolCall = null;
                    }
                  } catch (e: any) {
                    console.error(`[STREAM_PROC] Tool call failed: ${e.message}`);
                    pendingToolCall = null;
                  }
                }
              }
            }
          }
        } catch (err: any) {
          log?.error('STREAM_DEBUG', `Stream error in round ${round}: ${err.message}`, err);
          console.error(`[STREAM_PROC] Stream error in round ${round}: ${err.name}: ${err.message}`, err.stack);
          throw err;
        }

        if (signal.aborted) break;

        if (currentToolCall) {
          toolCallsResults.push(currentToolCall);
          currentToolCall = null;
        }

        if (!hasToolCallsInThisRound) {
          finalAssistantContent = pendingAssistantContent;
          if (pendingAssistantContent) {
            await prisma.message.create({
              data: {
                id: crypto.randomUUID(),
                sessionId,
                role: 'assistant',
                type: 'final',
                content: pendingAssistantContent,
              },
            }).catch((e) => log?.error('STREAM_DEBUG', `Failed to save final assistant text: ${e.message}`));
          }
          break;
        }

        const newToolCalls = toolCallsResults.slice(toolCallsStartLength);
        log?.debug('STREAM_DEBUG', `Round ${round} completed, saving ${newToolCalls.length} new tool calls`);

        if (newToolCalls.length > 0) {
          const toolUseBlocks = newToolCalls.map(tc => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            input: tc.input,
          }));

          const toolResultBlocks = newToolCalls.map(tc => ({
            type: 'tool_result' as const,
            tool_use_id: tc.id,
            content: tc.error || tc.result || '',
          }));

          await prisma.message.create({
            data: {
              id: crypto.randomUUID(),
              sessionId,
              role: 'assistant',
              type: 'final',
              content: JSON.stringify(toolUseBlocks),
            },
          }).catch((e) => log?.error('STREAM_DEBUG', `Failed to save assistant message: ${e.message}`));

          await prisma.message.create({
            data: {
              id: crypto.randomUUID(),
              sessionId,
              role: 'tool',
              type: 'tool_result',
              content: JSON.stringify(toolResultBlocks),
            },
          }).catch((e) => log?.error('STREAM_DEBUG', `Failed to save tool result message: ${e.message}`));
        }

        pendingAssistantContent = '';
      }

      fullContent = finalAssistantContent;

      const duration = Date.now() - totalStartTime;

      // @ts-ignore - TypeScript doesn't track assignments inside async generator
      log?.debug('AI_CLIENT', 'Response', {
        duration,
        inputTokens,
        outputTokens,
        stopReason,
        assistantContentLength: fullContent.length,
        assistantContentPreview: fullContent.slice(0, 200) + (fullContent.length > 200 ? '...' : ''),
        toolCallsCount: toolCallsResults.length,
        toolCalls: toolCallsResults.map(tc => ({
          name: tc.name,
          resultLength: tc.result?.length || 0,
        })),
      });

      if (signal.aborted) {
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'idle' },
        }).catch(() => {});
        this.broadcast(sessionId, 'error', 'Task cancelled');
        return;
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'completed', streamingContent: null },
      }).catch(() => {});

      console.log(`[STREAM_PROC] Session ${sessionId} completed, content length: ${fullContent.length}, tool calls: ${toolCallsResults.length}`);
      this.broadcast(sessionId, 'done');

    } catch (err: any) {
      if (err.name === 'AbortError' || signal.aborted) {
        console.log(`[STREAM_PROC] Session ${sessionId} cancelled`);
        this.broadcast(sessionId, 'error', '任务已取消');
      } else {
        console.error(`[STREAM_PROC] Session ${sessionId} failed:`, err);

        let errorMessage = err.message;
        if (errorMessage.includes('Could not resolve authentication') || errorMessage.includes('apiKey')) {
          errorMessage = 'API 认证失败，请检查设置中的 API Key 是否正确';
        } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
          errorMessage = '网络请求失败，请检查网络连接';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = '请求超时，请重试';
        }

        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'failed', streamingContent: null },
        }).catch(() => {});
        this.broadcast(sessionId, 'error', errorMessage);
      }
    } finally {
      this.runningTasks.delete(sessionId);
    }
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    const { getMcpManager } = await import('./mcp-manager.js');
    const mcpManager = getMcpManager();
    return mcpManager.callTool(name, args);
  }
}

export const streamProcessor = new StreamProcessor();