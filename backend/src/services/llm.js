const { ChatOpenAI } = require("@langchain/openai");

function buildLlm() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    configuration: process.env.OPENAI_BASE_URL
      ? { baseURL: process.env.OPENAI_BASE_URL }
      : undefined,
    model: "gpt-4o-mini",
    temperature: 0.2
  });
}

module.exports = { buildLlm };
