import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import type { HspPlan } from "./schema";

const tableName = env.HSP_TABLE_NAME;

const client = createClient();

export async function persistHspPlan(plan: HspPlan): Promise<void> {
  if (!tableName) {
    throw new Error("HSP_TABLE_NAME must be defined to store plans");
  }

  const command = new PutCommand({
    TableName: tableName,
    Item: {
      planId: plan.id,
      sessionId: plan.sessionId,
      problemId: plan.problemId,
      goal: plan.goal,
      summary: plan.summary,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt ?? plan.createdAt,
      steps: plan.steps,
      meta: plan.meta,
    },
  });

  await client.send(command);
}

function createClient() {
  if (!env.AWS_REGION) {
    throw new Error("AWS_REGION must be set for DynamoDB access");
  }

  const base = new DynamoDBClient({
    region: env.AWS_REGION,
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

