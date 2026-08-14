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
        log.debug('STORE', message, meta);
      } else {
        log.info('STORE', message, meta);
      }
    }
  }
}

export interface Session {
  id: string;
  title: string;
  model: string;
  status: 'idle' | 'streaming' | 'completed' | 'failed';
  streamingContent?: string;
  isPinned: boolean;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

function toSession(s: {
  id: string;
  title: string;
  model: string;
  status: string;
  streamingContent?: string | null;
  isPinned: boolean;
  cwd: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { messages: number };
}): Session {
  return {
    id: s.id,
    title: s.title,
    model: s.model,
    status: s.status as Session['status'],
    streamingContent: s.streamingContent ?? undefined,
    isPinned: s.isPinned,
    cwd: s.cwd,
    createdAt: s.createdAt.getTime(),
    updatedAt: s.updatedAt.getTime(),
    messageCount: s._count?.messages,
  };
}

export async function listSessions(limit = 50, offset = 0): Promise<Session[]> {
  const sessions = await prisma.session.findMany({
    include: { _count: { select: { messages: true } } },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
    skip: offset,
  });
  return sessions.map(toSession);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const s = await prisma.session.findUnique({
    where: { id },
    include: { _count: { select: { messages: true } } },
  });
  return s ? toSession(s) : undefined;
}

export async function createSession(model: string, title?: string, cwd?: string): Promise<Session> {
  const session = await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      title: title || '新对话',
      model,
      status: 'idle',
      isPinned: false,
      cwd: cwd || '',
    },
    include: { _count: { select: { messages: true } } },
  });
  storeLog(session.id, 'DEBUG', 'Session created', { title: session.title, model });
  return toSession(session);
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  await prisma.session.update({ where: { id }, data: { title } });
  storeLog(id, 'DEBUG', 'Session title updated', { title });
}

export async function updateSessionPin(id: string, isPinned: boolean): Promise<void> {
  await prisma.session.update({ where: { id }, data: { isPinned } });
}

export async function updateSessionCwd(id: string, cwd: string): Promise<void> {
  await prisma.session.update({ where: { id }, data: { cwd } });
}

export async function deleteSession(id: string): Promise<void> {
  await prisma.session.delete({ where: { id } });
  storeLog(id, 'DEBUG', 'Session deleted');
}

export async function updateSessionStatus(
  id: string,
  status: 'idle' | 'streaming' | 'completed' | 'failed',
  streamingContent?: string | null
): Promise<void> {
  await prisma.session.update({
    where: { id },
    data: { status, streamingContent },
  });
  storeLog(id, 'DEBUG', 'Session status updated', {
    status,
    streamingContentLength: streamingContent?.length,
  });
}

export async function appendStreamingContent(id: string, chunk: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id } });
  if (session) {
    await prisma.session.update({
      where: { id },
      data: { streamingContent: (session.streamingContent || '') + chunk },
    });
  }
}

export async function autoTitle(sessionId: string, userContent: string): Promise<void> {
  const session = await getSession(sessionId);
  if (session && session.title === '新对话' && typeof userContent === 'string') {
    const title = userContent.slice(0, 30) + (userContent.length > 30 ? '...' : '');
    await updateSessionTitle(sessionId, title);
  }
}
