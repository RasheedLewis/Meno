const {
  success,
  badRequest,
  internalError,
} = require("../shared/response");
const { putConnection } = require("../shared/connections");
const presence = require("../shared/presence");
const { broadcastToSession } = require("../shared/broadcast");
const { buildEndpoint } = require("../shared/utils");

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const sessionId = params.sessionId?.trim();
    const participantId = params.participantId?.trim();
    const name = params.name?.trim();
    const role = params.role?.trim() || "student";
    const client = params.client?.trim() || "web";

    if (!sessionId || !participantId || !name) {
      return badRequest("Missing required connection parameters");
    }

    const connectionId = event.requestContext.connectionId;

    await putConnection({
      connectionId,
      sessionId,
      participantId,
      name,
      role,
      client,
    });

    const presenceRecord = await presence.markOnline({
      sessionId,
      participantId,
      name,
      role,
    });

    await broadcastToSession({
      sessionId,
      endpoint: buildEndpoint(event),
      payload: {
        type: "presence.event",
        data: {
          sessionId,
          participantId,
          status: presenceRecord?.status ?? "online",
          isTyping: presenceRecord?.isTyping ?? false,
          isSpeaking: presenceRecord?.isSpeaking ?? false,
          lastSeen: presenceRecord?.lastSeen ?? new Date().toISOString(),
          extra: presenceRecord?.extra,
        },
      },
    });

    return success();
  } catch (error) {
    console.error("Connect handler failed", error);
    return internalError();
  }
};

