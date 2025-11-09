exports.handler = async (event) => {
  console.log("Lease set", JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};

