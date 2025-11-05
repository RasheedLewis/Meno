import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";
import type { HeavyValidationRecord, QuickCheckResult } from "@/lib/dialogue/types";

export interface DialogueState {
  sessionId: string;
  planId: string;
  currentStepIndex: number;
  completedStepIds: string[];
  hintLevel: number;
  attemptCount: number;
  lastPromptAt?: string;
  lastStudentTurnAt?: string;
  updatedAt: string;
  recapIssued?: boolean;
  quickChecks: QuickCheckResult[];
  validations: HeavyValidationRecord[];
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
  if (!result.Item) return null;

  const state = result.Item as DialogueState;
  if (typeof state.hintLevel !== "number") {
    state.hintLevel = 0;
  }
  if (typeof state.attemptCount !== "number") {
    state.attemptCount = 0;
  }
  if (typeof state.recapIssued !== "boolean") {
    state.recapIssued = false;
  }
  if (!Array.isArray(state.quickChecks)) {
    state.quickChecks = [];
  }
  if (!Array.isArray(state.validations)) {
    state.validations = [];
  }

  return state;
};

export const upsertDialogueState = async (state: DialogueState): Promise<void> => {
  if (!tableName) {
    throw new Error("DIALOGUE_TABLE_NAME must be defined to use dialogue store");
  }

  const command = new PutCommand({
    TableName: tableName,
    Item: {
      ...state,
      updatedAt: new Date().toISOString(),
    },
  });

  await client.send(command);
};

export const createInitialState = (sessionId: string, planId: string): DialogueState => ({
  sessionId,
  planId,
  currentStepIndex: 0,
  completedStepIds: [],
  hintLevel: 0,
  attemptCount: 0,
  updatedAt: new Date().toISOString(),
  lastPromptAt: new Date().toISOString(),
  lastStudentTurnAt: undefined,
  recapIssued: false,
  quickChecks: [],
  validations: [],
});

