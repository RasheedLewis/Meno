const {
  PutCommand,
  DeleteCommand,
  GetCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const { documentClient } = require("./dynamo");
const config = require("./config");

const sessionIndexName = config.sessionConnectionsIndex;

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function putConnection({
  connectionId,
  sessionId,
  participantId,
  name,
  role,
  client,
}) {
  const item = {
    connectionId,
    sessionId,
    participantId,
    name,
    role,
    client,
    connectedAt: new Date().toISOString(),
    ttl: nowSeconds() + config.connectionTtlSeconds,
  };

  console.log(`[connections] Storing connection: ${JSON.stringify({ connectionId, sessionId, participantId })}`);
  await documentClient.send(
    new PutCommand({
      TableName: config.tables.connections,
      Item: item,
    }),
  );
  console.log(`[connections] Connection stored successfully`);

  return item;
}

async function deleteConnection(connectionId) {
  await documentClient.send(
    new DeleteCommand({
      TableName: config.tables.connections,
      Key: { connectionId },
    }),
  );
}

async function getConnection(connectionId) {
  const result = await documentClient.send(
    new GetCommand({
      TableName: config.tables.connections,
      Key: { connectionId },
    }),
  );
  return result.Item || null;
}

async function listConnections(sessionId) {
  if (!sessionId) {
    console.warn(`[connections] listConnections called with empty sessionId`);
    return [];
  }

  console.log(`[connections] Querying connections for sessionId: ${sessionId}, table: ${config.tables.connections}, index: ${sessionIndexName}`);
  const result = await documentClient.send(
    new QueryCommand({
      TableName: config.tables.connections,
      IndexName: sessionIndexName,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
    }),
  );

  console.log(`[connections] Query returned ${result.Items?.length || 0} items`);
  return result.Items || [];
}

module.exports = {
  putConnection,
  deleteConnection,
  getConnection,
  listConnections,
};

