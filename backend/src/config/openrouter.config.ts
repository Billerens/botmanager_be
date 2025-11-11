import { registerAs } from "@nestjs/config";

export default registerAs("openrouter", () => ({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  httpReferer: process.env.OPENROUTER_HTTP_REFERER,
  xTitle: process.env.OPENROUTER_X_TITLE,
  defaultModel:
    process.env.OPENROUTER_DEFAULT_MODEL || "meta-llama/llama-3.3-70b-instruct",
}));
