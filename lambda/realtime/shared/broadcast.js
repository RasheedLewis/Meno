const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const { listConnections, deleteConnection } = require("./connections");

async function postToConnection(client, connectionId, data) {
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      }),
    );
  } catch (error) {
    if (error.name === "GoneException" || error.statusCode === 410) {
      await deleteConnection(connectionId);
      return false;
    }
    throw error;
  }
  return true;
}

const resolveRegion = () => process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

async function broadcastToSession({
  sessionId,
  endpoint,
  payload,
  excludeConnectionId,
}) {
  const connections = await listConnections(sessionId);
  console.log(`[broadcast] Found ${connections.length} connections for session ${sessionId}`);
  if (!connections.length) {
    console.warn(`[broadcast] No connections found for session ${sessionId}`);
    return;
  }

  const region = resolveRegion();
  const client = new ApiGatewayManagementApiClient(
    region
      ? {
          region,
          endpoint,
        }
      : { endpoint },
  );

  const filtered = connections.filter((connection) => connection.connectionId !== excludeConnectionId);
  console.log(`[broadcast] Broadcasting to ${filtered.length} connections (excluding ${excludeConnectionId || 'none'})`);

  await Promise.all(
    filtered.map((connection) =>
        postToConnection(client, connection.connectionId, payload).catch(
          (error) => {
            console.error(
              "Failed to post to connection",
              connection.connectionId,
              error,
            );
          },
        ),
      ),
  );
}

async function sendToConnection({ endpoint, connectionId, payload }) {
  const region = resolveRegion();
  const client = new ApiGatewayManagementApiClient(
    region
      ? {
          region,
          endpoint,
        }
      : { endpoint },
  );
  await postToConnection(client, connectionId, payload);
}

module.exports = {
  broadcastToSession,
  sendToConnection,
};

