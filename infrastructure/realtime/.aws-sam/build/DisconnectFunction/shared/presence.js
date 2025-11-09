const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const { documentClient } = require("./dynamo");
const config = require("./config");

const ONLINE_STATUS = "online";
const DISCONNECTED_STATUS = "disconnected";

const buildPresenceUpdateExpression = (attributes) => {
  const expressions = [];
  const names = {};
  const values = {};

  const add = (attributeName, value, useAlias = true) => {
    if (value === undefined) {
      return;
    }
    const alias = useAlias ? `#${attributeName}` : attributeName;
    const placeholder = `:${attributeName}`;
    if (useAlias) {
      names[alias] = attributeName;
      expressions.push(`${alias} = ${placeholder}`);
    } else {
      expressions.push(`${attributeName} = ${placeholder}`);
    }
    values[placeholder] = value;
  };

  add("name", attributes.name);
  add("role", attributes.role);
  add("status", attributes.status);
  add("isTyping", attributes.isTyping, false);
  add("isSpeaking", attributes.isSpeaking, false);
  add("lastSeen", attributes.lastSeen, false);
  add("extra", attributes.extra, false);
  add("expiresAt", attributes.expiresAtSeconds, false);

  if (!expressions.length) {
    return { updateExpression: undefined, names: undefined, values: {} };
  }

  return {
    updateExpression: `SET ${expressions.join(", ")}`,
    names: Object.keys(names).length ? names : undefined,
    values,
  };
};

async function updatePresenceRecord(sessionId, participantId, attributes) {
  const timestamp = new Date().toISOString();
  const ttlSeconds = attributes.status === DISCONNECTED_STATUS
    ? config.presenceDisconnectedTtlSeconds
    : config.presenceOnlineTtlSeconds;

  const { updateExpression, names, values } = buildPresenceUpdateExpression({
    ...attributes,
    lastSeen: attributes.lastSeen ?? timestamp,
    expiresAtSeconds: Math.floor(Date.now() / 1000) + ttlSeconds,
  });

  if (!updateExpression) {
    return null;
  }

  const result = await documentClient.send(
    new UpdateCommand({
      TableName: config.tables.presence,
      Key: {
        sessionId,
        participantId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    }),
  );

  return result.Attributes;
}

async function markOnline({ sessionId, participantId, name, role }) {
  return updatePresenceRecord(sessionId, participantId, {
    name,
    role,
    status: ONLINE_STATUS,
    isTyping: false,
    isSpeaking: false,
  });
}

async function applyPresenceUpdate(sessionId, participantId, payload) {
  return updatePresenceRecord(sessionId, participantId, payload);
}

async function markDisconnected(sessionId, participantId) {
  return updatePresenceRecord(sessionId, participantId, {
    status: DISCONNECTED_STATUS,
    isTyping: false,
    isSpeaking: false,
  });
}

async function heartbeat(sessionId, participantId) {
  return updatePresenceRecord(sessionId, participantId, {});
}

module.exports = {
  markOnline,
  applyPresenceUpdate,
  markDisconnected,
  heartbeat,
};

