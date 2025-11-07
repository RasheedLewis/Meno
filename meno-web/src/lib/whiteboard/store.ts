import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";

const client = getDocumentClient();

const tableName = env.WHITEBOARD_TABLE_NAME;

if (!tableName) {
  console.warn("WHITEBOARD_TABLE_NAME is not configured; whiteboard persistence disabled");
}

export interface WhiteboardSnapshotRecord {
  sessionId: string;
  snapshot: string;
  updatedAt: string;
  expiresAt?: number;
}

const TTL_SECONDS = 60 * 60 * 24; // 24 hours

const computeExpiry = () => Math.floor(Date.now() / 1000) + TTL_SECONDS;

export const getWhiteboardSnapshot = async (sessionId: string): Promise<WhiteboardSnapshotRecord | null> => {
  if (!tableName) return null;

  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { sessionId },
    }),
  );

  if (!response.Item) {
    return null;
  }

  return response.Item as WhiteboardSnapshotRecord;
};

export const putWhiteboardSnapshot = async (
  sessionId: string,
  snapshot: string,
  updatedAt: string,
): Promise<void> => {
  if (!tableName) return;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        sessionId,
        snapshot,
        updatedAt,
        expiresAt: computeExpiry(),
      } satisfies WhiteboardSnapshotRecord,
    }),
  );
};

