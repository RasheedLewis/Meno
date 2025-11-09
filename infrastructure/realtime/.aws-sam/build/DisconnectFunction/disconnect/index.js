const {
  success,
  internalError,
} = require("../shared/response");
const { getConnection, deleteConnection } = require("../shared/connections");
const presence = require("../shared/presence");
const { broadcastToSession } = require("../shared/broadcast");
const { buildEndpoint, nowIso } = require("../shared/utils");

exports.handler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const connection = await getConnection(connectionId);
    if (!connection) {
      return success(); // nothing to do
    }

    await deleteConnection(connectionId);

    const record = await presence.markDisconnected(
      connection.sessionId,
      connection.participantId,
    );

    await broadcastToSession({
      sessionId: connection.sessionId,
      endpoint: buildEndpoint(event),
      payload: {
        type: "presence.event",
        data: {
          sessionId: connection.sessionId,
          participantId: connection.participantId,
          status: record?.status ?? "disconnected",
          isTyping: false,
          isSpeaking: false,
          lastSeen: record?.lastSeen ?? nowIso(),
          extra: record?.extra,
        },
      },
    });

    return success();
  } catch (error) {
    console.error("Disconnect handler failed", error);
    return internalError();
  }
};

