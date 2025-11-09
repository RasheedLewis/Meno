const {
  success,
  gone,
  internalError,
} = require("../shared/response");
const { getConnection } = require("../shared/connections");
const { clearActiveLine } = require("../shared/session");
const { broadcastToSession } = require("../shared/broadcast");
const { buildEndpoint } = require("../shared/utils");

exports.handler = async (event) => {
  try {
    const connection = await getConnection(event.requestContext.connectionId);
    if (!connection) {
      return gone();
    }

    await clearActiveLine(connection.sessionId);

    await broadcastToSession({
      sessionId: connection.sessionId,
      endpoint: buildEndpoint(event),
      payload: {
        type: "control.lease.state",
        data: {
          sessionId: connection.sessionId,
          leaseId: null,
          stepIndex: null,
          leaseTo: null,
          leaseIssuedAt: null,
          leaseExpiresAt: null,
        },
      },
    });

    return success({ ok: true });
  } catch (error) {
    console.error("control.lease.release failed", error);
    return internalError();
  }
};

