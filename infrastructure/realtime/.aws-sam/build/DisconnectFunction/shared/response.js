const json = (statusCode, payload) => ({
  statusCode,
  body: payload !== undefined ? JSON.stringify(payload) : undefined,
});

const success = (payload) => json(200, payload);
const badRequest = (message) => json(400, { message });
const internalError = () => json(500, { message: "Internal server error" });
const gone = () => json(410, { message: "Connection not found" });

module.exports = {
  json,
  success,
  badRequest,
  internalError,
  gone,
};

