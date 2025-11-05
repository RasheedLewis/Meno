import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";

const client = getDocumentClient();

const tableName = env.SESSION_TABLE_NAME;

if (!tableName) {
  console.warn("SESSION_TABLE_NAME is not configured; session registry disabled");
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
  participants: Array<{
    id: string;
    name: string;
    role: "student" | "teacher" | "observer";
    joinedAt: string;
  }>;
}

const TTL_SECONDS = 60 * 60 * 6; // 6 hours

export const DEFAULT_MAX_PARTICIPANTS = 4;

const computeExpiry = () => Math.floor(Date.now() / 1000) + TTL_SECONDS;

export const createSession = async (record: SessionRecord): Promise<void> => {
  if (!tableName) return;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        ...record,
        expiresAt: computeExpiry(),
        maxParticipants: record.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS,
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
    }),
  );

  return response.Item ? (response.Item as SessionRecord) : null;
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
  return item ? (item as SessionRecord) : null;
};

export const addParticipantToSession = async (
  sessionId: string,
  participant: SessionRecord["participants"][number],
): Promise<SessionRecord | null> => {
  if (!tableName) return null;

  const current = await getSessionById(sessionId);
  if (!current) {
    return null;
  }

  const participants = [...(current.participants ?? [])];
  const existingIndex = participants.findIndex((item) => item.id === participant.id);

  if (existingIndex >= 0) {
    participants[existingIndex] = {
      ...participants[existingIndex],
      name: participant.name,
      role: participant.role,
    };
  } else {
    participants.push(participant);
  }

  const expiresAt = computeExpiry();

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { sessionId },
      UpdateExpression: "SET participants = :participants, expiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":participants": participants,
        ":expiresAt": expiresAt,
      },
    }),
  );

  return {
    ...current,
    participants,
    expiresAt,
  };
};
