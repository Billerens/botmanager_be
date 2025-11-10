import { registerAs } from "@nestjs/config";

export default registerAs("cloudAi", () => ({
  baseUrl: process.env.CLOUD_AI_BASE_URL || "https://agent.timeweb.cloud",
  defaultAgentAccessId: process.env.CLOUD_AI_AGENT_ACCESS_ID, // Опциональный ID агента по умолчанию
  defaultAuthToken: process.env.CLOUD_AI_DEFAULT_AUTH_TOKEN, // Опциональный токен по умолчанию
}));

