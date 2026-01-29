import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  apiPrefix: process.env.API_PREFIX || "api",
  // Базовый домен для публичных субдоменов (*.shops.domain, *.booking.domain, *.pages.domain)
  baseDomain: process.env.BASE_DOMAIN || "botmanagertest.online",
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : [
        "http://localhost:3001",
        "http://localhost:3000",
        "http://localhost:3002",
        "https://botmanagertest.online",
        "https://app.botmanagertest.online",
        "https://api.botmanagertest.online",
        "https://uforge.online",
      ],
  webhookBaseUrl:
    process.env.WEBHOOK_BASE_URL || "https://api.botmanagertest.online",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3001",
  // URL внешнего фронтенда для shop, booking и custom pages (Next.js проект)
  externalFrontendUrl:
    process.env.EXTERNAL_FRONTEND_URL || "https://uforge.online",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
}));
