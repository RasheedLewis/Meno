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
    if (!payload || typeof payload !== "object" || !payload.event) {
      return badRequest("Invalid presence payload");
    }

    const connection = await getConnection(event.requestContext.connectionId);
    if (!connection) {
      return gone();
    }

    const eventPayload = payload.event;
    if (!eventPayload || typeof eventPayload.type !== "string") {
      return badRequest("Invalid presence event");
    }

    let record = null;

    switch (eventPayload.type) {
      case "join":
        record = await presence.markOnline({
          sessionId: connection.sessionId,
          participantId: connection.participantId,
          name: connection.name,
          role: connection.role,
        });
        break;
      case "typing":
        record = await presence.applyPresenceUpdate(
          connection.sessionId,
          connection.participantId,
          {
            isTyping: Boolean(eventPayload.isTyping),
          status: eventPayload.isTyping ? "typing" : "online",
          },
        );
        break;
      case "speaking":
        record = await presence.applyPresenceUpdate(
          connection.sessionId,
          connection.participantId,
          {
            isSpeaking: Boolean(eventPayload.isSpeaking),
          status: eventPayload.isSpeaking ? "speaking" : "online",
          },
        );
        break;
      default:
        return badRequest(`Unsupported presence event: ${eventPayload.type}`);
    }

    if (record) {
      const envelope = {
        sessionId: connection.sessionId,
        participantId: connection.participantId,
        record: {
          sessionId: record.sessionId ?? connection.sessionId,
          participantId: record.participantId ?? connection.participantId,
          name: record.name ?? connection.name,
          role: record.role ?? connection.role,
          color: record.color,
          status: record.status ?? "online",
          isTyping: Boolean(record.isTyping),
          isSpeaking: Boolean(record.isSpeaking),
          lastSeen: record.lastSeen ?? nowIso(),
          muted: record.muted,
          addressed: record.addressed,
          caption: record.caption,
          expiresAt: record.expiresAt,
          extra: record.extra,
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
    }

    return success({ ok: true });
  } catch (error) {
    if (error.statusCode === 400) {
      return badRequest(error.message);
    }
    console.error("presence.update failed", error);
    return internalError();
  }
};

