const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

module.exports = {
  tables: {
    chat: required("CHAT_TABLE_NAME"),
    presence: required("PRESENCE_TABLE_NAME"),
    sessions: required("SESSION_TABLE_NAME"),
    connections: required("CONNECTIONS_TABLE_NAME"),
  },
  connectionTtlSeconds: 60 * 60 * 6, // 6 hours
  presenceOnlineTtlSeconds: 60 * 10, // 10 minutes
  presenceDisconnectedTtlSeconds: 60 * 2, // 2 minutes
  defaultLeaseDurationMs: 30_000,
  sessionConnectionsIndex: "sessionId-index",
};

