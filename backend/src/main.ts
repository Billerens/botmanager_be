import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { getSchemaPath } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import compression from "compression";
import * as bodyParser from "body-parser";
import { AppModule } from "./app.module";
import { ValidationExceptionFilter } from "./common/filters/validation-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

// Импорты всех DTO для Swagger
import {
  UserResponseDto,
  AuthResponseDto,
  VerificationRequiredResponseDto,
} from "./modules/auth/dto/auth-response.dto";
import {
  TwoFactorStatusResponseDto,
  InitializeTwoFactorResponseDto,
  EnableTwoFactorResponseDto,
} from "./modules/auth/dto/two-factor.dto";
import {
  BotResponseDto,
  BotStatsResponseDto,
} from "./modules/bots/dto/bot-response.dto";
import {
  PublicShopBotResponseDto,
  PublicBookingBotResponseDto,
} from "./modules/bots/dto/public-bot-response.dto";
import {
  ProductResponseDto,
  ProductStatsResponseDto,
  ErrorResponseDto as ProductErrorDto,
  UpdateStockResponseDto,
  ToggleActiveResponseDto,
  DeleteResponseDto as ProductDeleteDto,
} from "./modules/products/dto/product-response.dto";
import {
  MessageResponseDto,
  BroadcastResponseDto,
  MessageStatsResponseDto,
  DialogResponseDto,
  GroupResponseDto,
  UserResponseDto as MessageUserDto,
  DialogStatsResponseDto,
  BroadcastStatusResponseDto,
  ErrorResponseDto as MessageErrorDto,
} from "./modules/messages/dto/message-response.dto";
import {
  LeadResponseDto,
  LeadStatsResponseDto,
  ErrorResponseDto as LeadErrorDto,
  DeleteResponseDto as LeadDeleteDto,
} from "./modules/leads/dto/lead-response.dto";
import { SubscriptionResponseDto } from "./modules/subscription/dto/subscription-response.dto";
import { DashboardStatsResponseDto } from "./modules/analytics/dto/analytics-response.dto";
import { ActivityLogResponseDto } from "./modules/activity-log/dto/activity-log-response.dto";
import {
  TelegramWebhookResponseDto,
  TelegramBotInfoResponseDto,
  TelegramMessageResponseDto,
  TelegramCallbackResponseDto,
} from "./modules/telegram/dto/telegram-response.dto";
import { UploadResponseDto } from "./modules/upload/dto/upload-response.dto";
import {
  SpecialistResponseDto,
  ServiceResponseDto,
  TimeSlotResponseDto,
  BookingResponseDto,
  BookingStatsResponseDto,
  ErrorResponseDto as BookingErrorDto,
  DeleteResponseDto as BookingDeleteDto,
  CleanupResponseDto,
  ScheduleResponseDto,
} from "./modules/booking/dto/booking-response.dto";
import {
  UserStatsResponseDto,
  ErrorResponseDto as UserErrorDto,
  UpdateRoleResponseDto,
  ToggleActiveResponseDto as UserToggleDto,
  DeleteResponseDto as UserDeleteDto,
} from "./modules/users/dto/user-response.dto";

// Критически важные переменные окружения
const CRITICAL_ENV_VARS = [
  {
    name: "DATABASE_HOST",
    description: "Хост базы данных PostgreSQL",
    example: "localhost или your-db-host.com",
  },
  {
    name: "DATABASE_PORT",
    description: "Порт базы данных PostgreSQL",
    example: "5432",
  },
  {
    name: "DATABASE_USERNAME",
    description: "Имя пользователя базы данных",
    example: "botmanager",
  },
  {
    name: "DATABASE_PASSWORD",
    description: "Пароль базы данных",
    example: "your-secure-password",
  },
  {
    name: "DATABASE_NAME",
    description: "Название базы данных",
    example: "botmanager_prod",
  },
  {
    name: "JWT_SECRET",
    description: "Секретный ключ для JWT токенов",
    example: "your-super-secret-jwt-key-32-chars",
  },
  {
    name: "REDIS_HOST",
    description: "Хост подключения к Redis",
    example: "localhost или your-redis-host.com",
  },
  {
    name: "REDIS_PORT",
    description: "Порт подключения к Redis",
    example: "6379",
  },
  {
    name: "REDIS_PASSWORD",
    description: "Пароль подключения к Redis",
    example: "your-redis-password",
  },
  {
    name: "FRONTEND_URL",
    description: "Хост подключения к Frontend",
    example: "localhost или your-frontend-host.com",
  },
  {
    name: "TELEGRAM_BOT_TOKEN",
    description: "Токен бота Telegram для верификации пользователей",
    example: "your-telegram-bot-token",
  },
];

// Опциональные переменные окружения (для Cloud AI API)
const OPTIONAL_ENV_VARS = [
  {
    name: "CLOUD_AI_BASE_URL",
    description: "Базовый URL для Cloud AI API",
    example: "https://agent.timeweb.cloud",
    default: "https://agent.timeweb.cloud",
  },
  {
    name: "CLOUD_AI_AGENT_ACCESS_ID",
    description: "ID доступа к AI агенту (можно передавать в методах сервиса)",
    example: "your-agent-access-id",
  },
  {
    name: "CLOUD_AI_DEFAULT_AUTH_TOKEN",
    description:
      "Токен авторизации для Cloud AI API (можно передавать в методах сервиса)",
    example: "your-auth-token",
  },
];

// Функция проверки критически важных переменных окружения
function checkCriticalEnvVars() {
  const missingVars: typeof CRITICAL_ENV_VARS = [];

  CRITICAL_ENV_VARS.forEach((envVar) => {
    if (!process.env[envVar.name]) {
      missingVars.push(envVar);
    }
  });

  if (missingVars.length > 0) {
    console.log(
      "\n❌ ОШИБКА: Отсутствуют критически важные переменные окружения!\n"
    );
    console.log("📋 Необходимо настроить следующие переменные:\n");

    missingVars.forEach((envVar, index) => {
      console.log(`${index + 1}. ${envVar.name}`);
      console.log(`   📝 Назначение: ${envVar.description}`);
      console.log(`   💡 Пример: ${envVar.example}`);
      console.log("");
    });

    console.log("🔧 Способы настройки:");
    console.log("   • Создайте файл .env в папке backend/");
    console.log("   • Установите переменные в облачном сервисе");
    console.log("   • Используйте команду: export VARIABLE_NAME=value");
    console.log("");
    console.log(
      "📖 Подробнее: https://docs.nestjs.com/techniques/configuration"
    );
    console.log("");

    process.exit(1);
  } else {
    console.log("✅ Все критически важные переменные окружения настроены");
  }
}

// Функция проверки опциональных переменных окружения
function checkOptionalEnvVars() {
  const missingVars: Array<(typeof OPTIONAL_ENV_VARS)[number]> = [];

  OPTIONAL_ENV_VARS.forEach((envVar) => {
    if (!process.env[envVar.name]) {
      missingVars.push(envVar);
    }
  });

  if (missingVars.length > 0) {
    console.log(
      "\n⚠️  ПРЕДУПРЕЖДЕНИЕ: Отсутствуют некоторые опциональные переменные окружения\n"
    );
    console.log("📋 Рекомендуется настроить следующие переменные:\n");

    missingVars.forEach((envVar, index) => {
      console.log(`${index + 1}. ${envVar.name}`);
      console.log(`   📝 Назначение: ${envVar.description}`);
      console.log(`   💡 Пример: ${envVar.example}`);
      if (envVar.default) {
        console.log(`   🔧 Значение по умолчанию: ${envVar.default}`);
      }
      console.log("");
    });

    console.log("ℹ️  Примечание: Эти переменные опциональны.");
    console.log(
      "   Приложение будет работать, но функционал Cloud AI может быть недоступен."
    );
    console.log(
      "   Вы можете передавать эти параметры напрямую в методы сервиса.\n"
    );
  } else {
    console.log("✅ Все опциональные переменные окружения настроены");
  }
}

async function bootstrap() {
  // Проверяем переменные окружения перед запуском
  checkCriticalEnvVars();
  checkOptionalEnvVars();

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
    bodyParser: false, // Отключаем встроенный body parser для кастомной настройки
  });
  const configService = app.get(ConfigService);

  // Безопасность
  app.use(helmet());
  // SSE нельзя сжимать, иначе чанки буферизуются и стрим рвётся по таймауту
  app.use(
    compression({
      filter: (req, res) => {
        if (
          req.headers.accept?.includes("text/event-stream") ||
          req.originalUrl?.includes("/langchain-openrouter/chat/stream")
        ) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  // Настройка body parser с увеличенным лимитом для больших HTML файлов
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

  // Middleware для парсинга JSON, даже если Content-Type не установлен
  // Это помогает, когда клиент забывает установить Content-Type: application/json
  app.use((req, res, next) => {
    if (
      req.method === "POST" ||
      req.method === "PUT" ||
      req.method === "PATCH"
    ) {
      const contentType = req.headers["content-type"] || "";
      // Если Content-Type не установлен или не содержит json, но тело есть
      if (
        (!contentType || !contentType.includes("application/json")) &&
        req.body &&
        typeof req.body === "object" &&
        Object.keys(req.body).length === 0
      ) {
        // Пытаемся прочитать сырые данные из потока (если они еще не прочитаны)
        // Но это сложно сделать без изменения потока
        // Вместо этого просто логируем предупреждение
        const logger = new Logger("BodyParserWarning");
        logger.warn(
          `Request to ${req.url} has no Content-Type header. Body may not be parsed correctly.`
        );
      }
    }
    next();
  });

  // CORS
  const corsOrigin =
    configService.get("app.corsOrigin") ||
    process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  app.enableCors({
    origin: corsOrigin ?? true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "x-telegram-init-data",
    ],
    exposedHeaders: ["Authorization"],
    optionsSuccessStatus: 200,
  });

  // Exception filter для обработки ошибок валидации
  app.useGlobalFilters(new ValidationExceptionFilter());

  // Interceptor для логирования запросов (выполняется после парсинга body)
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Валидация
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Swagger документация
  const config = new DocumentBuilder()
    .setTitle("BotManager API")
    .setDescription("API для управления Telegram-ботами")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      // Auth DTOs
      UserResponseDto,
      AuthResponseDto,
      VerificationRequiredResponseDto,
      TwoFactorStatusResponseDto,
      InitializeTwoFactorResponseDto,
      EnableTwoFactorResponseDto,

      // Bot DTOs
      BotResponseDto,
      BotStatsResponseDto,
      PublicShopBotResponseDto,
      PublicBookingBotResponseDto,

      // Product DTOs
      ProductResponseDto,
      ProductStatsResponseDto,
      ProductErrorDto,
      UpdateStockResponseDto,
      ToggleActiveResponseDto,
      ProductDeleteDto,

      // Message DTOs
      MessageResponseDto,
      BroadcastResponseDto,
      MessageStatsResponseDto,
      DialogResponseDto,
      GroupResponseDto,
      MessageUserDto,
      DialogStatsResponseDto,
      BroadcastStatusResponseDto,
      MessageErrorDto,

      // Lead DTOs
      LeadResponseDto,
      LeadStatsResponseDto,
      LeadErrorDto,
      LeadDeleteDto,

      // Subscription DTOs
      SubscriptionResponseDto,

      // Analytics DTOs
      DashboardStatsResponseDto,

      // Activity Log DTOs
      ActivityLogResponseDto,

      // Telegram DTOs
      TelegramWebhookResponseDto,
      TelegramBotInfoResponseDto,
      TelegramMessageResponseDto,
      TelegramCallbackResponseDto,

      // Upload DTOs
      UploadResponseDto,

      // Booking DTOs
      SpecialistResponseDto,
      ServiceResponseDto,
      TimeSlotResponseDto,
      BookingResponseDto,
      BookingStatsResponseDto,
      BookingErrorDto,
      BookingDeleteDto,
      CleanupResponseDto,
      ScheduleResponseDto,

      // User DTOs
      UserStatsResponseDto,
      UserErrorDto,
      UpdateRoleResponseDto,
      UserToggleDto,
      UserDeleteDto,
    ],
  });
  SwaggerModule.setup("api/docs", app, document);

  // Rate limiting
  app.use((req, res, next) => {
    // Простой rate limiting
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 минут
    const maxRequests = 100; // максимум 100 запросов за 15 минут

    // Здесь должна быть логика rate limiting с Redis
    next();
  });

  const port = configService.get("app.port") || process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");

  console.log(`🚀 BotManager API запущен на порту ${port}`);
  console.log(
    `📚 Swagger документация: http://${configService.get("app.host") || process.env.HOST || "localhost"}:${port}/api/docs`
  );
}

bootstrap();
