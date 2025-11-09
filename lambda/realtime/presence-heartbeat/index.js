exports.handler = async (event) => {
  console.log("Presence heartbeat", JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};

