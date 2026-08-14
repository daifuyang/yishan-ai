import type { AgentEvent } from '@/lib/sse-client';
import type { ActiveStream, ContentBlock, Message } from '@/types';

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  isFetchingMessages: boolean;
  streamingContent: string;
  pendingMessageId: string | null;
  activeStream: ActiveStream | null;
}

let _msgSeq = 0;
export const msgId = () => `msg-${++_msgSeq}`;

export function applyEvent(state: ChatState, event: AgentEvent): Partial<ChatState> {
  const assistantId = state.activeStream?.assistantId;

  switch (event.type) {
    case 'content_catchup': {
      if (!assistantId) return {};
      return {
        messages: state.messages.map((msg) =>
          msg.id === assistantId ? setContentWithCatchup(msg, event.content) : msg
        ),
        streamingContent: event.content,
      };
    }
    case 'content_block_delta': {
      if (!assistantId) return {};
      return {
        messages: state.messages.map((msg) =>
          msg.id === assistantId ? appendTextDelta(msg, event.delta.text) : msg
        ),
        streamingContent: state.streamingContent + event.delta.text,
      };
    }
    case 'tool_call': {
      if (!assistantId) return {};
      const toolUseBlock: ContentBlock = {
        type: 'tool_use',
        id: msgId(),
        name: event.data.tool,
        input: { ...(event.data.args || {}), description: event.data.description },
      };
      const assistantMsg = state.messages.find((msg) => msg.id === assistantId);
      if (!assistantMsg) return {};
      const existingContent = Array.isArray(assistantMsg.content) ? assistantMsg.content : [];
      const updatedContent: ContentBlock[] = [...existingContent, toolUseBlock];
      return {
        messages: state.messages.map((msg) =>
          msg.id === assistantId ? { ...msg, content: updatedContent } : msg
        ),
      };
    }
    case 'tool_result': {
      if (!assistantId) return {};
      return {
        messages: state.messages.map((msg) => {
          if (msg.id !== assistantId) return msg;
          if (!Array.isArray(msg.content)) return msg;
          const targetIdx = msg.content.findIndex(
            (c: ContentBlock) => c.type === 'tool_use' && !c.result
          );
          if (targetIdx < 0) return msg;
          const updatedContent = [...msg.content];
          updatedContent[targetIdx] = { ...updatedContent[targetIdx], result: event.data.result };
          return { ...msg, content: updatedContent };
        }),
      };
    }
    case 'tool_error': {
      if (!assistantId) return {};
      return {
        messages: state.messages.map((msg) => {
          if (msg.id !== assistantId) return msg;
          if (!Array.isArray(msg.content)) return msg;
          const targetIdx = msg.content.findIndex(
            (c: ContentBlock) => c.type === 'tool_use' && !c.error
          );
          if (targetIdx < 0) return msg;
          const updatedContent = [...msg.content];
          updatedContent[targetIdx] = { ...updatedContent[targetIdx], error: event.data.error };
          return { ...msg, content: updatedContent };
        }),
      };
    }
    case 'message_stop': {
      const { activeStream } = state;
      if (!activeStream) return {};
      return {
        messages: state.messages.map((msg) => {
          if (msg.id === activeStream.assistantId) {
            return { ...msg, status: 'success' as const };
          }
          if (activeStream.userId && msg.id === activeStream.userId) {
            return { ...msg, status: 'success' as const };
          }
          return msg;
        }),
        isStreaming: false,
        pendingMessageId: null,
        activeStream: null,
      };
    }
    case 'error': {
      const userId = state.activeStream?.userId;
      if (!assistantId) return {};
      return {
        messages: state.messages.map((msg) => {
          if (msg.id === assistantId) {
            return { ...msg, status: 'failed' as const, error: event.message || '发生未知错误' };
          }
          if (userId && msg.id === userId) {
            return { ...msg, status: 'failed' as const, error: event.message || '发生未知错误' };
          }
          return msg;
        }),
        isStreaming: false,
        streamingContent: '',
        pendingMessageId: null,
        activeStream: null,
      };
    }
  }
}

function appendTextDelta(msg: Message, textDelta: string): Message {
  if (typeof msg.content === 'string') {
    return { ...msg, content: msg.content + textDelta };
  }
  const blocks = msg.content as ContentBlock[];
  const lastTextBlockIndex = blocks.findLastIndex((b) => b.type === 'text');
  if (lastTextBlockIndex >= 0) {
    const updatedBlocks = [...blocks];
    updatedBlocks[lastTextBlockIndex] = {
      ...updatedBlocks[lastTextBlockIndex],
      text: (updatedBlocks[lastTextBlockIndex].text || '') + textDelta,
    };
    return { ...msg, content: updatedBlocks };
  }
  return { ...msg, content: [...blocks, { type: 'text', text: textDelta }] };
}

function setContentWithCatchup(msg: Message, newContent: string): Message {
  if (typeof msg.content === 'string') {
    return { ...msg, content: newContent };
  }
  const blocks = msg.content as ContentBlock[];
  const lastTextIdx = blocks.findLastIndex((b) => b.type === 'text');
  if (lastTextIdx >= 0) {
    const updatedBlocks = [...blocks];
    updatedBlocks[lastTextIdx] = { ...updatedBlocks[lastTextIdx], text: newContent };
    return { ...msg, content: updatedBlocks };
  }
  return { ...msg, content: [...blocks, { type: 'text', text: newContent }] };
}
