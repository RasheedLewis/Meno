import { NextResponse } from "next/server";
import {
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { getDocumentClient } from "@/lib/aws/dynamo";
import { env } from "@/env";

const DEFAULT_CHAT_LIMIT = 200;

interface Params {
  sessionId: string;
}

const requiredTables = () => {
  const { CHAT_TABLE_NAME, PRESENCE_TABLE_NAME, SESSION_TABLE_NAME } = env;
  if (!CHAT_TABLE_NAME || !PRESENCE_TABLE_NAME || !SESSION_TABLE_NAME) {
    throw new Error(
      "CHAT_TABLE_NAME, PRESENCE_TABLE_NAME and SESSION_TABLE_NAME must be configured",
    );
  }
  return {
    chat: CHAT_TABLE_NAME,
    presence: PRESENCE_TABLE_NAME,
    sessions: SESSION_TABLE_NAME,
  };
};

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  try {
    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId is required" },
        { status: 400 },
      );
    }

    const tables = requiredTables();
    const client = getDocumentClient();

    const url = new URL(request.url);
    const chatLimitParam = url.searchParams.get("chatLimit");
    const chatLimit =
      chatLimitParam && Number.isFinite(Number(chatLimitParam))
        ? Math.min(Number(chatLimitParam), 500)
        : DEFAULT_CHAT_LIMIT;

    const [chatResult, presenceResult, sessionResult] = await Promise.all([
      client.send(
        new QueryCommand({
          TableName: tables.chat,
          KeyConditionExpression: "sessionId = :sessionId",
          ExpressionAttributeValues: {
            ":sessionId": sessionId,
          },
          Limit: chatLimit,
          ScanIndexForward: true,
        }),
      ),
      client.send(
        new QueryCommand({
          TableName: tables.presence,
          KeyConditionExpression: "sessionId = :sessionId",
          ExpressionAttributeValues: {
            ":sessionId": sessionId,
          },
        }),
      ),
      client.send(
        new GetCommand({
          TableName: tables.sessions,
          Key: { sessionId },
        }),
      ),
    ]);

    if (!sessionResult.Item) {
      return NextResponse.json(
        { ok: false, error: "Session not found" },
        { status: 404 },
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    const messages =
      chatResult.Items?.map((item) => ({
        sessionId: item.sessionId as string,
        messageId: item.messageId as string,
        participantId: item.participantId as string | undefined,
        participantName: item.participantName as string | undefined,
        role: (item.role as string | undefined) ?? "student",
        content: item.content as string,
        createdAt: item.createdAt as string,
        meta: item.meta as Record<string, unknown> | undefined,
      })) ?? [];

    const participants =
      presenceResult.Items?.filter((item) => {
        const expiresAt = item.expiresAt as number | undefined;
        return !expiresAt || expiresAt >= nowSeconds;
      }).map((item) => ({
        sessionId: item.sessionId as string,
        participantId: item.participantId as string,
        name: (item.name as string | undefined) ?? null,
        role: (item.role as string | undefined) ?? "student",
        status: (item.status as string | undefined) ?? "online",
        isTyping: Boolean(item.isTyping),
        isSpeaking: Boolean(item.isSpeaking),
        lastSeen: (item.lastSeen as string | undefined) ?? null,
        color: (item.color as string | undefined) ?? "#B47538",
        extra: (item.extra as Record<string, unknown> | undefined) ?? undefined,
      })) ?? [];

    const activeLine = sessionResult.Item?.activeLine ?? null;

    return NextResponse.json({
      ok: true,
      data: {
        sessionId,
        chat: {
          messages,
          count: chatResult.Count ?? 0,
        },
        presence: {
          participants,
          count: participants.length,
        },
        activeLine,
      },
    });
  } catch (error) {
    console.error("Realtime hydrate failed", error);
    const message =
      error instanceof Error ? error.message : "Unknown realtime hydrate error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

