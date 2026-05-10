export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
}

export type MessageStatus = 'pending' | 'success' | 'failed' | 'stopped';

export interface Message {
  id: string;
  serverId?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  type?: 'user' | 'assistant' | 'final';
  content: string | ContentBlock[];
  thinking?: string;
  toolCalls?: ToolCall[];
  status?: MessageStatus;
  error?: string;
  model?: string;
}

export interface RawAPIMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  type?: string;
  content: string | RawContentBlock[] | { text: string };
}

export interface RawContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  error?: string;
  tool_use_id?: string;
}

export interface ToolCallGroup {
  type: 'context' | 'tool';
  tools: ToolCall[];
}

export interface ActiveStream {
  sessionId: string;
  userId: string | null;
  assistantId: string;
}
