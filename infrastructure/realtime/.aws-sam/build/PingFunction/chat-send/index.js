const { v4: uuidv4 } = require("uuid");

const {
  success,
  badRequest,
  gone,
  internalError,
} = require("../shared/response");
const { getConnection } = require("../shared/connections");
const { persistChatMessage } = require("../shared/chat");
const { broadcastToSession } = require("../shared/broadcast");
const { parseBody, buildEndpoint, nowIso } = require("../shared/utils");

exports.handler = async (event) => {
  try {
    const payload = parseBody(event).payload;
    const envelope = typeof payload === "object" && payload !== null ? payload : {};
    const rawMessage = envelope.message && typeof envelope.message === "object" ? envelope.message : null;

    const content =
      typeof envelope.content === "string"
        ? envelope.content
        : typeof rawMessage?.content === "string"
          ? rawMessage.content
          : null;
    if (!content) {
      return badRequest("Invalid chat payload: missing content");
    }

    const connection = await getConnection(event.requestContext.connectionId);
    if (!connection) {
      return gone();
    }

    const createdAt = envelope.createdAt || rawMessage?.createdAt || nowIso();
    const messageId = envelope.messageId || rawMessage?.id || rawMessage?.messageId || uuidv4();
    const role = rawMessage?.role || envelope.role || connection.role;
    const meta = {
      ...(typeof envelope.meta === "object" && envelope.meta !== null ? envelope.meta : rawMessage?.meta ?? {}),
    };

    const persistedMessage = {
      sessionId: connection.sessionId,
      messageId,
      participantId: connection.participantId,
      participantName: connection.name,
      role,
      content,
      createdAt,
      meta,
    };

    await persistChatMessage(persistedMessage);

    const broadcastMessage = {
      id: messageId,
      role,
      content,
      createdAt,
      meta: {
        ...meta,
        sessionId: connection.sessionId,
        participantId: connection.participantId,
      },
    };

    const broadcastPayload = {
      type: "chat.message",
      data: {
        sessionId: connection.sessionId,
        message: broadcastMessage,
      },
    };
    console.log(`[chat.send] Broadcasting message ${messageId} to session ${connection.sessionId}`);
    await broadcastToSession({
      sessionId: connection.sessionId,
      endpoint: buildEndpoint(event),
      payload: broadcastPayload,
      excludeConnectionId: event.requestContext.connectionId,
    });

    return success({ ok: true });
  } catch (error) {
    if (error.statusCode === 400) {
      return badRequest(error.message);
    }
    console.error("chat.send failed", error);
    return internalError();
  }
};

