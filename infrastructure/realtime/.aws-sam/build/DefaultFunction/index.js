exports.handler = async (event) => {
  console.log("Default route event", JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Unhandled action" }),
  };
};

