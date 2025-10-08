import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";

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
    console.log(
      "✅ Переменные окружения: ",
      JSON.stringify(process.env, null, 2)
    );
  }
}

async function bootstrap() {
  // Проверяем переменные окружения перед запуском
  checkCriticalEnvVars();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Безопасность
  app.use(helmet());
  app.use(compression());

  // CORS
  const corsOrigin = configService.get("app.corsOrigin");
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
    ],
    exposedHeaders: ["Authorization"],
    optionsSuccessStatus: 200,
  });

  // Валидация
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Swagger документация
  const config = new DocumentBuilder()
    .setTitle("BotManager API")
    .setDescription("API для управления Telegram-ботами")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
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
    `📚 Swagger документация: http://${configService.get("app.host")}:${port}/api/docs`
  );
}

bootstrap();
