const { v4: uuidv4 } = require("uuid");

const {
  success,
  badRequest,
  gone,
  internalError,
} = require("../shared/response");
const { getConnection } = require("../shared/connections");
const { setActiveLine } = require("../shared/session");
const { broadcastToSession } = require("../shared/broadcast");
const { parseBody, buildEndpoint, nowIso } = require("../shared/utils");
const config = require("../shared/config");

exports.handler = async (event) => {
  try {
    const payload = parseBody(event).payload;
    if (
      !payload ||
      typeof payload.stepIndex !== "number" ||
      Number.isNaN(payload.stepIndex)
    ) {
      return badRequest("stepIndex is required");
    }

    const connection = await getConnection(event.requestContext.connectionId);
    if (!connection) {
      return gone();
    }

    const now = Date.now();
    const leaseDuration =
      typeof payload.leaseDurationMs === "number" && payload.leaseDurationMs > 0
        ? payload.leaseDurationMs
        : config.defaultLeaseDurationMs;

    const lease = {
      leaseId: payload.leaseId || uuidv4(),
      stepIndex: payload.stepIndex,
      leaseTo: payload.leaseTo || connection.participantId,
      leaseIssuedAt: nowIso(),
      leaseExpiresAt: now + leaseDuration,
    };

    await setActiveLine(connection.sessionId, lease);

    await broadcastToSession({
      sessionId: connection.sessionId,
      endpoint: buildEndpoint(event),
      payload: {
        type: "control.lease.state",
        data: {
          sessionId: connection.sessionId,
          leaseId: lease.leaseId,
          stepIndex: lease.stepIndex,
          leaseTo: lease.leaseTo,
          leaseIssuedAt: lease.leaseIssuedAt,
          leaseExpiresAt: lease.leaseExpiresAt,
        },
      },
    });

    return success({ ok: true });
  } catch (error) {
    if (error.statusCode === 400) {
      return badRequest(error.message);
    }
    console.error("control.lease.set failed", error);
    return internalError();
  }
};

