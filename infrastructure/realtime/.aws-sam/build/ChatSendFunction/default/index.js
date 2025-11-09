const { success } = require("../shared/response");

exports.handler = async (event) => {
  console.warn("Unhandled websocket action", event.body);
  return success({ message: "Unhandled action" });
};

