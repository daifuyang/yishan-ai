import { z } from 'zod';
export declare const ChatMessageSchema: z.ZodObject<{
    role: z.ZodEnum<["user", "assistant", "system"]>;
    content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodAny, "many">]>;
}, "strip", z.ZodTypeAny, {
    role: "user" | "assistant" | "system";
    content: string | any[];
}, {
    role: "user" | "assistant" | "system";
    content: string | any[];
}>;
export declare const ChatRequestSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodAny, "many">]>;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant" | "system";
        content: string | any[];
    }, {
        role: "user" | "assistant" | "system";
        content: string | any[];
    }>, "many">;
    model: z.ZodOptional<z.ZodString>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    messages: {
        role: "user" | "assistant" | "system";
        content: string | any[];
    }[];
    model?: string | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    stream?: boolean | undefined;
}, {
    messages: {
        role: "user" | "assistant" | "system";
        content: string | any[];
    }[];
    model?: string | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    stream?: boolean | undefined;
}>;
export declare const ChatResponseSchema: z.ZodObject<{
    content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodAny, "many">]>;
    model: z.ZodString;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        inputTokens: number;
        outputTokens: number;
    }, {
        inputTokens: number;
        outputTokens: number;
    }>;
}, "strip", z.ZodTypeAny, {
    content: string | any[];
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}, {
    content: string | any[];
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export declare const SessionStatusSchema: z.ZodEnum<["idle", "streaming", "completed", "failed"]>;
export declare const SessionSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    model: z.ZodString;
    status: z.ZodEnum<["idle", "streaming", "completed", "failed"]>;
    streamingContent: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    messageCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "idle" | "streaming" | "completed" | "failed";
    model: string;
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    streamingContent?: string | undefined;
    messageCount?: number | undefined;
}, {
    status: "idle" | "streaming" | "completed" | "failed";
    model: string;
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    streamingContent?: string | undefined;
    messageCount?: number | undefined;
}>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type Session = z.infer<typeof SessionSchema>;
export declare const CreateSessionSchema: z.ZodObject<{
    model: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    model: string;
    title?: string | undefined;
}, {
    model: string;
    title?: string | undefined;
}>;
export declare const UpdateSessionSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
}, {
    title?: string | undefined;
}>;
export declare const SendMessageSchema: z.ZodObject<{
    content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodAny, "many">]>;
    model: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<["plan", "build"]>>;
}, "strip", z.ZodTypeAny, {
    content: string | any[];
    model?: string | undefined;
    mode?: "plan" | "build" | undefined;
}, {
    content: string | any[];
    model?: string | undefined;
    mode?: "plan" | "build" | undefined;
}>;
export declare const SSEEventSchema: z.ZodObject<{
    type: z.ZodEnum<["content_catchup", "content_block_start", "content_block_delta", "message_stop", "error", "plan_start", "plan_step", "plan_complete", "build_step_start", "build_step_done", "build_complete"]>;
    data: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    type: "content_catchup" | "content_block_start" | "content_block_delta" | "message_stop" | "error" | "plan_start" | "plan_step" | "plan_complete" | "build_step_start" | "build_step_done" | "build_complete";
    data?: any;
}, {
    type: "content_catchup" | "content_block_start" | "content_block_delta" | "message_stop" | "error" | "plan_start" | "plan_step" | "plan_complete" | "build_step_start" | "build_step_done" | "build_complete";
    data?: any;
}>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
