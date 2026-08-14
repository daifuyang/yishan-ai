import { prisma } from '../lib/stream-processor.js';
import type { AgentMessage } from '../types/agent-events.js';

export type SessionEvent =
  | { type: 'user-message'; text: string; timestamp: number }
  | { type: 'assistant-start'; messageId: string }
  | { type: 'assistant-chunk'; messageId: string; text: string }
  | { type: 'assistant-done'; messageId: string }
  | {
      type: 'tool-call';
      messageId: string;
      callId: string;
      name: string;
      args: Record<string, unknown>;
    }
  | { type: 'tool-result'; callId: string; result: string }
  | { type: 'error'; messageId: string; error: string };

export interface StoredSessionEvent {
  id: number;
  sessionId: string;
  seq: number;
  event: SessionEvent;
  createdAt: Date;
}

export async function appendEvent(
  sessionId: string,
  event: SessionEvent
): Promise<StoredSessionEvent> {
  const maxSeq = await prisma.sessionEvent.aggregate({
    where: { sessionId },
    _max: { seq: true },
  });
  const seq = (maxSeq._max.seq ?? 0) + 1;

  const row = await prisma.sessionEvent.create({
    data: {
      sessionId,
      seq,
      type: event.type,
      dataJson: JSON.stringify(event),
    },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  return {
    id: row.id,
    sessionId: row.sessionId,
    seq: row.seq,
    event,
    createdAt: row.createdAt,
  };
}

export async function getEvents(
  sessionId: string,
  afterSeq?: number
): Promise<StoredSessionEvent[]> {
  const rows = await prisma.sessionEvent.findMany({
    where: {
      sessionId,
      ...(afterSeq != null ? { seq: { gt: afterSeq } } : {}),
    },
    orderBy: { seq: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    seq: row.seq,
    event: JSON.parse(row.dataJson) as SessionEvent,
    createdAt: row.createdAt,
  }));
}

export function buildMessages(events: StoredSessionEvent[]): AgentMessage[] {
  const messages: AgentMessage[] = [];
  const assistantBuffers = new Map<
    string,
    { texts: string[]; toolUses: { id: string; name: string; input: Record<string, unknown> }[] }
  >();

  for (const { event } of events) {
    switch (event.type) {
      case 'user-message': {
        messages.push({ role: 'user', content: event.text });
        break;
      }
      case 'assistant-start': {
        assistantBuffers.set(event.messageId, { texts: [], toolUses: [] });
        break;
      }
      case 'assistant-chunk': {
        const buf = assistantBuffers.get(event.messageId);
        if (buf) buf.texts.push(event.text);
        break;
      }
      case 'tool-call': {
        const buf = assistantBuffers.get(event.messageId);
        if (buf) buf.toolUses.push({ id: event.callId, name: event.name, input: event.args });
        break;
      }
      case 'assistant-done': {
        const buf = assistantBuffers.get(event.messageId);
        if (buf) {
          const content: AgentMessage['content'] = [];
          const text = buf.texts.join('');
          if (text) content.push({ type: 'text', text });
          for (const tc of buf.toolUses) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
          }
          messages.push({
            role: 'assistant',
            content: content.length === 1 && content[0].type === 'text' ? text : content,
          });
          assistantBuffers.delete(event.messageId);
        }
        break;
      }
      case 'tool-result': {
        messages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: event.callId, content: event.result }],
        });
        break;
      }
      case 'error': {
        break;
      }
    }
  }

  // Flush any incomplete assistant buffers (streaming interrupted)
  for (const [, buf] of assistantBuffers) {
    const content: AgentMessage['content'] = [];
    const text = buf.texts.join('');
    if (text) content.push({ type: 'text', text });
    for (const tc of buf.toolUses) {
      content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }
    if (content.length > 0) {
      messages.push({
        role: 'assistant',
        content: content.length === 1 && content[0].type === 'text' ? text : content,
      });
    }
  }

  return messages;
}
