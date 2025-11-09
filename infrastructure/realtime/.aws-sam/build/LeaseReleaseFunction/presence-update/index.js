const {
  success,
  badRequest,
  gone,
  internalError,
} = require("../shared/response");
const { getConnection } = require("../shared/connections");
const presence = require("../shared/presence");
const { broadcastToSession } = require("../shared/broadcast");
const { parseBody, buildEndpoint, nowIso } = require("../shared/utils");

exports.handler = async (event) => {
  try {
    const payload = parseBody(event).payload;
    if (!payload || typeof payload !== "object") {
      return badRequest("Invalid presence payload");
    }

    const connection = await getConnection(event.requestContext.connectionId);
    if (!connection) {
      return gone();
    }

    const record = await presence.applyPresenceUpdate(
      connection.sessionId,
      connection.participantId,
      {
        status: payload.status,
        isTyping: payload.isTyping,
        isSpeaking: payload.isSpeaking,
        extra: payload.extra,
      },
    );

    const broadcastPayload = {
      type: "presence.event",
      data: {
        sessionId: connection.sessionId,
        participantId: connection.participantId,
        status: record?.status ?? payload.status ?? "online",
        isTyping: record?.isTyping ?? payload.isTyping ?? false,
        isSpeaking: record?.isSpeaking ?? payload.isSpeaking ?? false,
        lastSeen: record?.lastSeen ?? nowIso(),
        extra: record?.extra ?? payload.extra,
      },
    };

    await broadcastToSession({
      sessionId: connection.sessionId,
      endpoint: buildEndpoint(event),
      payload: broadcastPayload,
    });

    return success({ ok: true });
  } catch (error) {
    if (error.statusCode === 400) {
      return badRequest(error.message);
    }
    console.error("presence.update failed", error);
    return internalError();
  }
};

