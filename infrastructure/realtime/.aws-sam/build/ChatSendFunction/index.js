exports.handler = async (event) => {
  console.log("Chat send", JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};

