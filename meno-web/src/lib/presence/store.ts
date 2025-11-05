import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";

import { pickPresenceColor } from "./colors";
import type { PresenceRecord, PresenceStatus } from "./types";

const client = getDocumentClient();

const tableName = env.PRESENCE_TABLE_NAME;

if (!tableName) {
  console.warn("PRESENCE_TABLE_NAME is not configured; presence persistence disabled");
}

const ONLINE_TTL_SECONDS = 60 * 10; // 10 minutes
const DISCONNECTED_TTL_SECONDS = 60 * 2; // 2 minutes grace window

const toPresenceRecord = (item: Record<string, unknown>): PresenceRecord => ({
  sessionId: String(item.sessionId),
  participantId: String(item.participantId),
  name: String(item.name ?? ""),
  role: (item.role as PresenceRecord["role"]) ?? "student",
  color: String(item.color ?? "#B47538"),
  status: (item.status as PresenceStatus) ?? "online",
  isTyping: Boolean(item.isTyping),
  isSpeaking: Boolean(item.isSpeaking),
  lastSeen: String(item.lastSeen ?? new Date().toISOString()),
  expiresAt: typeof item.expiresAt === "number" ? item.expiresAt : undefined,
});

const computeExpiry = (status: PresenceStatus) =>
  Math.floor(Date.now() / 1000) + (status === "disconnected" ? DISCONNECTED_TTL_SECONDS : ONLINE_TTL_SECONDS);

export const listPresence = async (sessionId: string): Promise<PresenceRecord[]> => {
  if (!tableName) return [];

  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
    }),
  );

  const now = Math.floor(Date.now() / 1000);
  return (response.Items ?? [])
    .map((item) => toPresenceRecord(item as Record<string, unknown>))
    .filter((item) => !item.expiresAt || item.expiresAt >= now);
};

export const getPresence = async (
  sessionId: string,
  participantId: string,
): Promise<PresenceRecord | null> => {
  if (!tableName) return null;

  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        sessionId,
        participantId,
      },
    }),
  );

  if (!response.Item) {
    return null;
  }

  return toPresenceRecord(response.Item as Record<string, unknown>);
};

export const upsertPresence = async (
  payload: Omit<PresenceRecord, "color" | "status" | "isTyping" | "isSpeaking" | "lastSeen"> & {
    color?: string;
    status?: PresenceStatus;
  },
): Promise<PresenceRecord> => {
  if (!tableName) {
    throw new Error("PRESENCE_TABLE_NAME must be configured for presence upserts");
  }

  const existing = await getPresence(payload.sessionId, payload.participantId);
  const currentList = await listPresence(payload.sessionId);
  const usedColors = new Set(currentList.map((record) => record.color));

  if (existing?.color) {
    usedColors.add(existing.color);
  }

  const color = existing?.color ?? payload.color ?? pickPresenceColor(usedColors);
  const status: PresenceStatus = payload.status ?? "online";
  const record: PresenceRecord = {
    sessionId: payload.sessionId,
    participantId: payload.participantId,
    name: payload.name,
    role: payload.role,
    color,
    status,
    isTyping: false,
    isSpeaking: false,
    lastSeen: new Date().toISOString(),
    expiresAt: computeExpiry(status),
  };

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: record,
    }),
  );

  return record;
};

export const updatePresenceState = async (
  sessionId: string,
  participantId: string,
  updates: Partial<Pick<PresenceRecord, "status" | "isTyping" | "isSpeaking" | "name" | "role">>,
): Promise<void> => {
  if (!tableName) return;

  const existing = await getPresence(sessionId, participantId);
  const status = (updates.status ?? existing?.status ?? "online") as PresenceStatus;
  const expressions: string[] = ["lastSeen = :lastSeen", "expiresAt = :expiresAt"];
  const attributes: Record<string, unknown> = {
    ":lastSeen": new Date().toISOString(),
    ":expiresAt": computeExpiry(status),
  };

  if (updates.status) {
    expressions.push("#status = :status");
    attributes[":status"] = updates.status;
  }

  if (updates.isTyping !== undefined) {
    expressions.push("isTyping = :typing");
    attributes[":typing"] = updates.isTyping;
  }

  if (updates.isSpeaking !== undefined) {
    expressions.push("isSpeaking = :speaking");
    attributes[":speaking"] = updates.isSpeaking;
  }

  if (updates.name !== undefined) {
    expressions.push("#name = :name");
    attributes[":name"] = updates.name;
  }

  if (updates.role !== undefined) {
    expressions.push("#role = :role");
    attributes[":role"] = updates.role;
  }

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        sessionId,
        participantId,
      },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: attributes,
      ExpressionAttributeNames: {
        ...(updates.status ? { "#status": "status" } : {}),
        ...(updates.name !== undefined ? { "#name": "name" } : {}),
        ...(updates.role !== undefined ? { "#role": "role" } : {}),
      },
    }),
  );
};

export const markDisconnected = async (sessionId: string, participantId: string): Promise<void> => {
  await updatePresenceState(sessionId, participantId, {
    status: "disconnected",
    isTyping: false,
    isSpeaking: false,
  });
};
