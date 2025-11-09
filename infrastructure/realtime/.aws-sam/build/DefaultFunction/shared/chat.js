const { PutCommand } = require("@aws-sdk/lib-dynamodb");

const { documentClient } = require("./dynamo");
const config = require("./config");

function buildSortKey(createdAt, messageId) {
  return `${createdAt}#${messageId}`;
}

async function persistChatMessage({
  sessionId,
  messageId,
  participantId,
  participantName,
  role,
  content,
  createdAt,
  meta,
}) {
  const sortKey = buildSortKey(createdAt, messageId);
  await documentClient.send(
    new PutCommand({
      TableName: config.tables.chat,
      Item: {
        sessionId,
        sortKey,
        messageId,
        participantId,
        participantName,
        role,
        content,
        createdAt,
        meta,
      },
    }),
  );
}

module.exports = {
  persistChatMessage,
};

