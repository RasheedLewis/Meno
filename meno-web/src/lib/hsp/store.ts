import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";
import { getDocumentClient } from "@/lib/aws/dynamo";
import type { HspPlan } from "./schema";

const tableName = env.HSP_TABLE_NAME;

const client = getDocumentClient();

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

export const fetchHspPlan = async (planId: string) => {
  if (!tableName) {
    throw new Error("HSP_TABLE_NAME must be defined to retrieve plans");
  }

  const command = new GetCommand({
    TableName: tableName,
    Key: { planId },
  });

  const result = await client.send(command);
  return result.Item as HspPlan | undefined;
};

