const {
  success,
  gone,
  internalError,
} = require("../shared/response");
const { getConnection } = require("../shared/connections");
const presence = require("../shared/presence");

exports.handler = async (event) => {
  try {
    const connection = await getConnection(event.requestContext.connectionId);
    if (!connection) {
      return gone();
    }

    await presence.heartbeat(connection.sessionId, connection.participantId);

    return success({ ok: true });
  } catch (error) {
    console.error("presence.heartbeat failed", error);
    return internalError();
  }
};

