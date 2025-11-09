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

    const envelope = {
      sessionId: connection.sessionId,
      participantId: connection.participantId,
      record: {
        sessionId: connection.sessionId,
        participantId: connection.participantId,
        name: record?.name ?? connection.name,
        role: record?.role ?? connection.role,
        color: record?.color,
        status: record?.status ?? "disconnected",
        isTyping: false,
        isSpeaking: false,
        lastSeen: record?.lastSeen ?? nowIso(),
        muted: record?.muted,
        addressed: record?.addressed,
        caption: record?.caption,
        expiresAt: record?.expiresAt,
        extra: record?.extra,
      },
    };

    await broadcastToSession({
      sessionId: connection.sessionId,
      endpoint: buildEndpoint(event),
      payload: {
        type: "presence.event",
        data: envelope,
      },
    });

    return success();
  } catch (error) {
    console.error("Disconnect handler failed", error);
    return internalError();
  }
};

