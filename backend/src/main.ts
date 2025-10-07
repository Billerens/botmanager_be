import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Безопасность
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: configService.get("app.corsOrigin"),
    credentials: true,
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

  const port = configService.get("app.port");
  await app.listen(port);

  console.log(`🚀 BotManager API запущен на порту ${port}`);
  console.log(`📚 Swagger документация: http://localhost:${port}/api/docs`);
}

bootstrap();
