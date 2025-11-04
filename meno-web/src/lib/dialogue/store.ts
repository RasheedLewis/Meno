import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";

export interface DialogueState {
  sessionId: string;
  planId: string;
  currentStepIndex: number;
  completedStepIds: string[];
  updatedAt: string;
}

const tableName = env.DIALOGUE_TABLE_NAME;
const client = getDocumentClient();

export const getDialogueState = async (sessionId: string): Promise<DialogueState | null> => {
  if (!tableName) {
    throw new Error("DIALOGUE_TABLE_NAME must be defined to use dialogue store");
  }

  const command = new GetCommand({
    TableName: tableName,
    Key: { sessionId },
  });

  const result = await client.send(command);
  return (result.Item as DialogueState) ?? null;
};

export const upsertDialogueState = async (state: DialogueState): Promise<void> => {
  if (!tableName) {
    throw new Error("DIALOGUE_TABLE_NAME must be defined to use dialogue store");
  }

  const command = new PutCommand({
    TableName: tableName,
    Item: state,
  });

  await client.send(command);
};

export const createInitialState = (sessionId: string, planId: string): DialogueState => ({
  sessionId,
  planId,
  currentStepIndex: 0,
  completedStepIds: [],
  updatedAt: new Date().toISOString(),
});

