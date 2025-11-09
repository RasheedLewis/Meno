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
    if (!payload || typeof payload.content !== "string") {
      return badRequest("Invalid chat payload");
    }

    const connection = await getConnection(event.requestContext.connectionId);
    if (!connection) {
      return gone();
    }

    const createdAt = payload.createdAt || nowIso();
    const messageId = payload.messageId || uuidv4();
    const meta = payload.meta ?? {};

    const message = {
      sessionId: connection.sessionId,
      messageId,
      participantId: connection.participantId,
      participantName: connection.name,
      role: connection.role,
      content: payload.content,
      createdAt,
      meta,
    };

    await persistChatMessage(message);

    await broadcastToSession({
      sessionId: connection.sessionId,
      endpoint: buildEndpoint(event),
      payload: {
        type: "chat.message",
        data: {
          sessionId: connection.sessionId,
          messageId,
          participantId: connection.participantId,
          participantName: connection.name,
          role: connection.role,
          content: payload.content,
          createdAt,
          meta,
        },
      },
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

