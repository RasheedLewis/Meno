const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const { documentClient } = require("./dynamo");
const config = require("./config");

async function setActiveLine(sessionId, lease) {
  await documentClient.send(
    new UpdateCommand({
      TableName: config.tables.sessions,
      Key: { sessionId },
      UpdateExpression: "SET activeLine = :lease",
      ExpressionAttributeValues: {
        ":lease": lease,
      },
    }),
  );
}

async function clearActiveLine(sessionId) {
  await documentClient.send(
    new UpdateCommand({
      TableName: config.tables.sessions,
      Key: { sessionId },
      UpdateExpression: "REMOVE activeLine",
    }),
  );
}

module.exports = {
  setActiveLine,
  clearActiveLine,
};

