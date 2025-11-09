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
  if (!connections.length) {
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

  await Promise.all(
    connections
      .filter((connection) => connection.connectionId !== excludeConnectionId)
      .map((connection) =>
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

