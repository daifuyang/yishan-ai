import { z } from 'zod';

export const TextContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ImageContentBlockSchema = z.object({
  type: z.literal('image'),
  source: z.string(),
});

export const ContentBlockSchema = z.discriminatedUnion('type', [
  TextContentBlockSchema,
  ImageContentBlockSchema,
]);

export type TextContentBlock = z.infer<typeof TextContentBlockSchema>;
export type ImageContentBlock = z.infer<typeof ImageContentBlockSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
});

export const ChatResponseSchema = z.object({
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
  }),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const SessionStatusSchema = z.enum(['idle', 'streaming', 'completed', 'failed']);

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string(),
  status: SessionStatusSchema,
  streamingContent: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  messageCount: z.number().optional(),
});

export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionSchema = z.object({
  model: z.string(),
  title: z.string().optional(),
});

export const UpdateSessionSchema = z.object({
  title: z.string().optional(),
});

export const SendMessageSchema = z.object({
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
  model: z.string().optional(),
  mode: z.enum(['plan', 'build']).default('build'),
});

export const SSEEventSchema = z.object({
  type: z.enum([
    'content_catchup',
    'content_block_start',
    'content_block_delta',
    'message_stop',
    'error',
    'plan_start',
    'plan_step',
    'plan_complete',
    'build_step_start',
    'build_step_done',
    'build_complete',
  ]),
  data: z.unknown().optional(),
});

export type SSEEvent = z.infer<typeof SSEEventSchema>;
