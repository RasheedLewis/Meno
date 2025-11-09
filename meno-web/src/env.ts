import { z } from "zod";

const serverSchema = z.object({
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required").optional(),
    MATHPIX_APP_ID: z.string().min(1, "MATHPIX_APP_ID is required").optional(),
    MATHPIX_APP_KEY: z.string().min(1, "MATHPIX_APP_KEY is required").optional(),
    SUPABASE_SERVICE_ROLE_KEY: z
        .string()
        .min(1, "SUPABASE_SERVICE_ROLE_KEY is required")
        .optional(),
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    HSP_TABLE_NAME: z.string().optional(),
    DIALOGUE_TABLE_NAME: z.string().optional(),
    PRESENCE_TABLE_NAME: z.string().optional(),
    CHAT_TABLE_NAME: z.string().optional(),
    SESSION_TABLE_NAME: z.string().optional(),
    SYMPY_SERVICE_URL: z.string().url().optional(),
    WHITEBOARD_TABLE_NAME: z.string().optional(),
    YJS_WEBSOCKET_URL: z.string().url().optional(),
    REALTIME_WEBSOCKET_URL: z.string().url().optional(),
});

const clientSchema = z.object({
    NEXT_PUBLIC_APP_URL: z
        .string()
        .url("NEXT_PUBLIC_APP_URL must be a valid URL")
        .default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z
        .string()
        .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
        .optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    NEXT_PUBLIC_YJS_WEBSOCKET_URL: z
        .string()
        .url("NEXT_PUBLIC_YJS_WEBSOCKET_URL must be a valid URL")
        .default("ws://localhost:1234/yjs"),
    NEXT_PUBLIC_REALTIME_WEBSOCKET_URL: z
        .string()
        .url("NEXT_PUBLIC_REALTIME_WEBSOCKET_URL must be a valid URL")
        .optional(),
});

const _serverEnv = serverSchema.safeParse(process.env);

if (!_serverEnv.success) {
    console.error(
        "❌ Invalid server environment variables:",
        JSON.stringify(_serverEnv.error.flatten().fieldErrors, null, 2),
    );
    throw new Error("Fix server environment variables");
}

const _clientEnv = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_YJS_WEBSOCKET_URL: process.env.NEXT_PUBLIC_YJS_WEBSOCKET_URL,
    NEXT_PUBLIC_REALTIME_WEBSOCKET_URL:
        process.env.NEXT_PUBLIC_REALTIME_WEBSOCKET_URL,
});

if (!_clientEnv.success) {
    console.error(
        "❌ Invalid public environment variables:",
        JSON.stringify(_clientEnv.error.flatten().fieldErrors, null, 2),
    );
    throw new Error("Fix public environment variables");
}

export const env = {
    ..._serverEnv.data,
    ..._clientEnv.data,
};

