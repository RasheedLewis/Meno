const { success, internalError } = require("../shared/response");
const { sendToConnection } = require("../shared/broadcast");
const { buildEndpoint } = require("../shared/utils");

exports.handler = async (event) => {
  try {
    await sendToConnection({
      endpoint: buildEndpoint(event),
      connectionId: event.requestContext.connectionId,
      payload: {
        type: "system.pong",
        data: {
          timestamp: Date.now(),
        },
      },
    });
    return success({ ok: true });
  } catch (error) {
    console.error("system.ping failed", error);
    return internalError();
  }
};

