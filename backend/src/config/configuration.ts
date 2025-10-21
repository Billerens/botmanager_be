import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  apiPrefix: process.env.API_PREFIX || "api",
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://botmanagertest.online",
        "https://api.botmanagertest.online",
      ],
  webhookBaseUrl:
    process.env.WEBHOOK_BASE_URL || "https://api.botmanagertest.online",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3001",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
}));
