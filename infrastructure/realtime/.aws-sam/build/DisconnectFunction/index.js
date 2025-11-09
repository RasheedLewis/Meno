exports.handler = async (event) => {
  console.log("Disconnect event", JSON.stringify(event));
  return { statusCode: 200 };
};

