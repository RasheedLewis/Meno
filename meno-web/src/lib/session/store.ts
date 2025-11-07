import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";

const client = getDocumentClient();

const tableName = env.SESSION_TABLE_NAME;

if (!tableName) {
  console.warn("SESSION_TABLE_NAME is not configured; session registry disabled");
}

export interface SessionParticipant {
  id: string;
  name: string;
  role: "student" | "teacher" | "observer";
  joinedAt: string;
}

export interface SessionRecord {
  sessionId: string;
  code: string;
  name?: string;
  difficulty?: string;
  creatorParticipantId: string;
  createdAt: string;
  expiresAt?: number;
  maxParticipants?: number;
  participants: Record<string, SessionParticipant>;
}

const TTL_SECONDS = 60 * 60 * 6; // 6 hours

export const DEFAULT_MAX_PARTICIPANTS = 4;

const computeExpiry = () => Math.floor(Date.now() / 1000) + TTL_SECONDS;

const normalizeParticipantsMap = (value: unknown): Record<string, SessionParticipant> => {
  if (!value) {
    return {};
  }

  if (Array.isArray(value)) {
    return value.reduce<Record<string, SessionParticipant>>((acc, item) => {
      if (item && typeof item === "object" && typeof item.id === "string") {
        acc[item.id] = {
          id: item.id,
          name: typeof item.name === "string" ? item.name : "",
          role: (item.role as SessionParticipant["role"]) ?? "student",
          joinedAt: typeof item.joinedAt === "string" ? item.joinedAt : new Date().toISOString(),
        };
      }
      return acc;
    }, {});
  }

  if (typeof value === "object") {
    const entries = value as Record<string, SessionParticipant>;
    return Object.entries(entries).reduce<Record<string, SessionParticipant>>((acc, [key, participant]) => {
      if (participant && typeof participant === "object") {
        const id = participant.id ?? key;
        if (typeof id === "string") {
          acc[id] = {
            id,
            name: participant.name ?? "",
            role: participant.role ?? "student",
            joinedAt: participant.joinedAt ?? new Date().toISOString(),
          };
        }
      }
      return acc;
    }, {});
  }

  return {};
};

export const participantsMapToList = (participants: Record<string, SessionParticipant> | undefined) =>
  Object.values(participants ?? {}).sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

const normalizeSessionRecord = (item: unknown): SessionRecord => {
  if (!item || typeof item !== "object") {
    throw new Error("Invalid session record");
  }

  const record = item as SessionRecord;
  const participants = normalizeParticipantsMap((record as unknown as { participants?: unknown }).participants);

  return {
    sessionId: record.sessionId,
    code: record.code,
    name: record.name,
    difficulty: record.difficulty,
    creatorParticipantId: record.creatorParticipantId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    maxParticipants: record.maxParticipants,
    participants,
  };
};

export const createSession = async (record: SessionRecord): Promise<void> => {
  if (!tableName) return;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        ...record,
        expiresAt: computeExpiry(),
        maxParticipants: record.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS,
        participants: record.participants ?? {},
      },
      ConditionExpression: "attribute_not_exists(sessionId)",
    }),
  );
};

export const getSessionById = async (sessionId: string): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { sessionId },
      ConsistentRead: true,
    }),
  );

  return response.Item ? normalizeSessionRecord(response.Item) : null;
};

export const getSessionByCode = async (code: string): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "code-index",
      KeyConditionExpression: "code = :code",
      ExpressionAttributeValues: {
        ":code": code,
      },
      Limit: 1,
    }),
  );

  const item = response.Items?.[0];
  return item ? normalizeSessionRecord(item) : null;
};

export const addParticipantToSession = async (
  sessionId: string,
  participant: SessionParticipant,
): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const current = await getSessionById(sessionId);
  if (!current) {
    return null;
  }

  const participants = { ...current.participants };
  const existing = participants[participant.id];
  participants[participant.id] = {
    id: participant.id,
    name: participant.name,
    role: participant.role,
    joinedAt: existing?.joinedAt ?? participant.joinedAt,
  };

  const expiresAt = computeExpiry();

  const response = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression: "SET participants = :participants, expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":participants": participants,
        ":expiresAt": expiresAt,
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  if (response.Attributes) {
    return normalizeSessionRecord(response.Attributes);
  }

  return {
    ...current,
    participants,
    expiresAt,
  };
};
