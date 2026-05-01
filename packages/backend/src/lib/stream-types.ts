export interface ToolCallResult {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface StreamOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  correlationId?: string;
}

export interface StartParams {
  sessionId: string;
  userMessage: string;
  options: StreamOptions;
  tools: any[];
}

export type SSEEventType =
  | 'content_block_delta'
  | 'tool_call'
  | 'tool_result'
  | 'tool_error'
  | 'message_stop'
  | 'error'
  | 'content_catchup';

export interface SSEEvent {
  type: SSEEventType;
  delta?: { type: 'text_delta'; text: string };
  data?: any;
  message?: string;
  content?: string;
}
