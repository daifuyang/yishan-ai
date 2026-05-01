export const DEFAULT_SESSION_LIMIT = 10;

export const AVAILABLE_MODELS = [
  { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7-highspeed' },
  { id: 'MiniMax-M2.7', name: 'MiniMax-M2.7' },
  { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5-highspeed' },
  { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5' },
  { id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1-highspeed' },
  { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1' },
] as const;

export type ChatMode = 'plan' | 'build';
