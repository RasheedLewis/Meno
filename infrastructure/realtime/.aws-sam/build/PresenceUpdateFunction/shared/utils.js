function parseBody(event) {
  if (!event || !event.body) {
    return {};
  }
  try {
    return JSON.parse(event.body);
  } catch (error) {
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}

function buildEndpoint(event) {
  const { domainName, stage } = event.requestContext;
  return `https://${domainName}/${stage}`;
}

const nowIso = () => new Date().toISOString();

module.exports = {
  parseBody,
  buildEndpoint,
  nowIso,
};

