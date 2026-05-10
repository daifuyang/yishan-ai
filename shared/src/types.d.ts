export type Role = 'user' | 'assistant' | 'system';
export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string | object[];
  createdAt: number;
  usageInput?: number;
  usageOutput?: number;
}
export interface PlanStep {
  id: string;
  action: string;
  command?: string;
  path?: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  output?: string;
  error?: string;
}
export interface Plan {
  planId: string;
  steps: PlanStep[];
  status: 'pending' | 'approved' | 'running' | 'completed' | 'partial';
}
export interface Task {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: number;
}
export interface Model {
  id: string;
  name: string;
  contextWindow: number;
  outputSpeed: string;
}
export declare const AVAILABLE_MODELS: Model[];
