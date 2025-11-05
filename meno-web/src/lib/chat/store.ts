import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";
import type { ChatMessage } from "@/lib/types/chat";

const client = getDocumentClient();

const tableName = env.CHAT_TABLE_NAME;

if (!tableName) {
  console.warn("CHAT_TABLE_NAME is not configured; chat persistence disabled");
}

const createSortKey = (createdAt: string, id: string) => `${createdAt}#${id}`;

export interface StoredChatMessage extends ChatMessage {
  sessionId: string;
  sortKey: string;
}

const mapItemToMessage = (item: Record<string, unknown>): ChatMessage => ({
  id: String(item.id),
  role: item.role as ChatMessage["role"],
  content: String(item.content ?? ""),
  createdAt: String(item.createdAt ?? new Date().toISOString()),
  meta: item.meta as ChatMessage["meta"],
});

export const listChatMessages = async (sessionId: string, limit = 200): Promise<ChatMessage[]> => {
  if (!tableName) return [];

  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
      Limit: limit,
      ScanIndexForward: true,
    }),
  );

  return (response.Items ?? []).map((item) => mapItemToMessage(item as Record<string, unknown>));
};

interface PersistChatInput {
  sessionId: string;
  message: ChatMessage;
}

export const persistChatMessage = async ({ sessionId, message }: PersistChatInput): Promise<void> => {
  if (!tableName) return;

  const sortKey = createSortKey(message.createdAt, message.id);

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        sessionId,
        sortKey,
        ...message,
      },
    }),
  );
};
