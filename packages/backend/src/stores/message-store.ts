import { getLogger } from '../lib/logger.js';
import { prisma } from '../lib/stream-processor.js';
import { appendEvent, buildMessages, getEvents } from './event-store.js';

const isDev = process.env.NODE_ENV !== 'production';

function storeLog(
  sessionId: string | null,
  level: 'DEBUG' | 'INFO',
  message: string,
  meta?: Record<string, unknown>
) {
  if (!isDev) return;
  if (sessionId) {
    const log = getLogger(sessionId);
    if (log) {
      if (level === 'DEBUG') {
        log.debug('MSG_STORE', message, meta);
      } else {
        log.info('MSG_STORE', message, meta);
      }
    }
  }
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string | object[];
  toolCalls?: unknown[];
  createdAt: number;
  usageInput?: number;
  usageOutput?: number;
  deletedAt?: number;
}

export async function getMessages(
  sessionId: string,
  _limit = 100,
  _offset = 0
): Promise<StoredMessage[]> {
  const events = await getEvents(sessionId);
  const agentMessages = buildMessages(events);

  return agentMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m, idx) => ({
      id: `evt-${idx}`,
      sessionId,
      role: m.role as 'user' | 'assistant',
      content: m.content as string | object[],
      createdAt: events[0]?.createdAt.getTime() ?? Date.now(),
    }));
}

export async function appendMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string | object[],
  usage?: { inputTokens: number; outputTokens: number },
  toolCalls?: unknown[]
): Promise<StoredMessage> {
  const messageId = crypto.randomUUID();

  if (role === 'user') {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    await appendEvent(sessionId, { type: 'user-message', text, timestamp: Date.now() });
  } else {
    await appendEvent(sessionId, { type: 'assistant-start', messageId });

    if (typeof content === 'string') {
      if (content) {
        await appendEvent(sessionId, { type: 'assistant-chunk', messageId, text: content });
      }
    } else {
      for (const block of content) {
        const b = block as Record<string, unknown>;
        if (b.type === 'text') {
          await appendEvent(sessionId, {
            type: 'assistant-chunk',
            messageId,
            text: b.text as string,
          });
        } else if (b.type === 'tool_use') {
          await appendEvent(sessionId, {
            type: 'tool-call',
            messageId,
            callId: b.id as string,
            name: b.name as string,
            args: (b.input as Record<string, unknown>) ?? {},
          });
        }
      }
    }

    if (toolCalls) {
      for (const tc of toolCalls) {
        const t = tc as Record<string, unknown>;
        await appendEvent(sessionId, {
          type: 'tool-call',
          messageId,
          callId: (t.id as string) ?? crypto.randomUUID(),
          name: t.name as string,
          args: (t.input as Record<string, unknown>) ?? {},
        });
      }
    }

    await appendEvent(sessionId, { type: 'assistant-done', messageId });
  }

  storeLog(sessionId, 'DEBUG', 'Message appended via events', {
    messageId: messageId.slice(0, 8),
    role,
    contentLength: typeof content === 'string' ? content.length : JSON.stringify(content).length,
    toolCallCount: toolCalls?.length || 0,
  });

  return {
    id: messageId,
    sessionId,
    role,
    content,
    toolCalls,
    createdAt: Date.now(),
    usageInput: usage?.inputTokens,
    usageOutput: usage?.outputTokens,
  };
}

export async function rewriteMessages(
  sessionId: string,
  messages: { role: string; content: unknown }[]
): Promise<void> {
  await prisma.sessionEvent.deleteMany({ where: { sessionId } });

  for (const msg of messages) {
    const role = msg.role as 'user' | 'assistant';
    const content = msg.content;

    if (role === 'user') {
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      await appendEvent(sessionId, { type: 'user-message', text, timestamp: Date.now() });
    } else {
      const messageId = crypto.randomUUID();
      await appendEvent(sessionId, { type: 'assistant-start', messageId });

      if (typeof content === 'string') {
        if (content) {
          await appendEvent(sessionId, { type: 'assistant-chunk', messageId, text: content });
        }
      } else if (Array.isArray(content)) {
        for (const block of content) {
          const b = block as Record<string, unknown>;
          if (b.type === 'text') {
            await appendEvent(sessionId, {
              type: 'assistant-chunk',
              messageId,
              text: b.text as string,
            });
          } else if (b.type === 'tool_use') {
            await appendEvent(sessionId, {
              type: 'tool-call',
              messageId,
              callId: (b.id as string) ?? crypto.randomUUID(),
              name: b.name as string,
              args: (b.input as Record<string, unknown>) ?? {},
            });
          }
        }
      }

      await appendEvent(sessionId, { type: 'assistant-done', messageId });
    }
  }

  storeLog(sessionId, 'DEBUG', 'Messages rewritten via events', { messageCount: messages.length });
}

export async function getAnthropicMessages(
  sessionId: string
): Promise<{ role: string; content: unknown }[]> {
  const events = await getEvents(sessionId);
  const messages = buildMessages(events);
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function softDeleteMessagesAfter(sessionId: string, messageId: string): Promise<void> {
  const msg = await prisma.message.findUnique({ where: { id: messageId, sessionId } });
  if (!msg) return;

  await prisma.message.updateMany({
    where: {
      sessionId,
      createdAt: { gte: msg.createdAt },
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  storeLog(sessionId, 'DEBUG', 'Messages soft deleted after', { messageId: messageId.slice(0, 8) });
}

export async function restoreMessages(sessionId: string, messageId: string): Promise<void> {
  const msg = await prisma.message.findUnique({ where: { id: messageId, sessionId } });
  if (!msg) return;

  await prisma.message.updateMany({
    where: {
      sessionId,
      createdAt: { gte: msg.createdAt },
      deletedAt: { not: null },
    },
    data: { deletedAt: null },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  storeLog(sessionId, 'DEBUG', 'Messages restored', { messageId: messageId.slice(0, 8) });
}
