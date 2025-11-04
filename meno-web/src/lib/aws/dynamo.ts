import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { env } from "@/env";

let documentClient: DynamoDBDocumentClient | null = null;

export const getDocumentClient = () => {
  if (documentClient) {
    return documentClient;
  }

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

  documentClient = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });

  return documentClient;
};

