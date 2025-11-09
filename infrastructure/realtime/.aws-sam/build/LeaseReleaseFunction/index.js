exports.handler = async (event) => {
  console.log("Lease release", JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};

