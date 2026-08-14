export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface TextDeltaEvent {
  type: 'text-delta';
  text: string;
}

export interface ToolStartEvent {
  type: 'tool-start';
  toolId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolDoneEvent {
  type: 'tool-done';
  toolId: string;
  toolName: string;
  result: string;
  isError: boolean;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export interface CompleteEvent {
  type: 'complete';
  content: string;
}

export type AgentEvent =
  | TextDeltaEvent
  | ToolStartEvent
  | ToolDoneEvent
  | ErrorEvent
  | CompleteEvent;

export interface ModelConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | AgentMessageContent[];
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  id?: string;
  tool_use_id?: string;
  content: string | unknown;
}

export type AgentMessageContent = TextBlock | ToolUseBlock | ToolResultBlock;

export type ExecuteToolFn = (name: string, args: Record<string, unknown>) => Promise<string>;

export interface AgentLoopParams {
  messages: AgentMessage[];
  tools: MCPTool[];
  model: ModelConfig;
  signal?: AbortSignal;
  executeTool: ExecuteToolFn;
  client: import('@anthropic-ai/sdk').default;
}
