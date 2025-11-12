import { registerAs } from "@nestjs/config";

export default registerAs("openrouter", () => {
  // Парсим список разрешенных моделей из переменной окружения
  // Формат: "model1,model2,model3" или "model1 model2 model3"
  const allowedModelsEnv = process.env.OPENROUTER_ALLOWED_MODELS || "";
  const allowedModels = allowedModelsEnv
    .split(/[,\s]+/)
    .map((model) => model.trim())
    .filter((model) => model.length > 0);

  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    httpReferer: process.env.OPENROUTER_HTTP_REFERER,
    xTitle: process.env.OPENROUTER_X_TITLE,
    defaultModel:
      process.env.OPENROUTER_DEFAULT_MODEL ||
      "meta-llama/llama-3.3-70b-instruct",
    allowedModels,
    // Настройки VPN прокси
    proxyUrl: process.env.OPENROUTER_PROXY_URL,
    proxyCheckTimeout: parseInt(
      process.env.OPENROUTER_PROXY_CHECK_TIMEOUT || "5000",
      10
    ),
  };
});
