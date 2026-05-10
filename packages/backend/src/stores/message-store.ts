import { getLogger } from '../lib/logger.js';
import { prisma } from '../lib/stream-processor.js';

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

interface PrismaMessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string | object[];
  toolCalls?: string | null;
  createdAt: Date;
  usageInput?: number | null;
  usageOutput?: number | null;
  deletedAt?: Date | null;
}

function parseContent(content: string | object[]): string | object[] {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }
  return content;
}

function toStoredMessage(m: PrismaMessageRow): StoredMessage {
  return {
    id: m.id,
    sessionId: m.sessionId,
    role: m.role as 'user' | 'assistant',
    content: parseContent(m.content),
    toolCalls: m.toolCalls ? (JSON.parse(m.toolCalls) as unknown[]) : undefined,
    createdAt: m.createdAt.getTime(),
    usageInput: m.usageInput ?? undefined,
    usageOutput: m.usageOutput ?? undefined,
    deletedAt: m.deletedAt ? m.deletedAt.getTime() : undefined,
  };
}

export async function getMessages(
  sessionId: string,
  limit = 100,
  offset = 0
): Promise<StoredMessage[]> {
  const messages = await prisma.message.findMany({
    where: { sessionId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
    skip: offset,
  });
  return messages.map(toStoredMessage);
}

export async function appendMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string | object[],
  usage?: { inputTokens: number; outputTokens: number },
  toolCalls?: unknown[]
): Promise<StoredMessage> {
  const contentJson = typeof content === 'string' ? content : JSON.stringify(content);
  const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;

  const message = await prisma.message.create({
    data: {
      id: crypto.randomUUID(),
      sessionId,
      role,
      type: role === 'user' ? 'user' : 'assistant',
      content: contentJson,
      toolCalls: toolCallsJson,
      usageInput: usage?.inputTokens,
      usageOutput: usage?.outputTokens,
    },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  storeLog(sessionId, 'DEBUG', 'Message appended', {
    messageId: message.id.slice(0, 8),
    role,
    contentLength: typeof content === 'string' ? content.length : JSON.stringify(content).length,
    toolCallCount: toolCalls?.length || 0,
  });

  return toStoredMessage(message);
}

export async function rewriteMessages(
  sessionId: string,
  messages: { role: string; content: unknown }[]
): Promise<void> {
  await prisma.message.deleteMany({ where: { sessionId } });

  await prisma.message.createMany({
    data: messages.map((msg) => ({
      id: crypto.randomUUID(),
      sessionId,
      role: msg.role,
      type: msg.role === 'user' ? 'user' : 'assistant',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    })),
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  storeLog(sessionId, 'DEBUG', 'Messages rewritten', { messageCount: messages.length });
}

export async function getAnthropicMessages(
  sessionId: string
): Promise<{ role: string; content: unknown }[]> {
  const messages = await prisma.message.findMany({
    where: { sessionId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  });
  return messages.map((m) => ({ role: m.role, content: parseContent(m.content) }));
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
