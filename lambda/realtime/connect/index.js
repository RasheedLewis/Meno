exports.handler = async (event) => {
  console.log("Connect event", JSON.stringify(event));
  return { statusCode: 200 };
};

