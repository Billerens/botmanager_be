import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { DataSource } from "typeorm";
import { RedisService } from "../modules/websocket/services/redis.service";

@ApiTags("Health")
@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService
  ) {}

  @Get()
  @ApiOperation({ summary: "Корневой эндпоинт / Health check" })
  @ApiResponse({
    status: 200,
    description: "Приложение работает нормально",
  })
  getRoot() {
    return {
      status: "ok",
      message: "UForge API is running",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get("health")
  @ApiOperation({ summary: "Health check эндпоинт" })
  @ApiResponse({
    status: 200,
    description: "Приложение работает нормально",
  })
  getHealth() {
    return {
      status: "ok",
      message: "UForge API is healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    };
  }

  @Get("health/ready")
  @ApiOperation({ summary: "Readiness check (DB + Redis)" })
  @ApiResponse({
    status: 200,
    description: "Сервис готов принимать рабочие запросы",
  })
  @ApiResponse({
    status: 503,
    description: "Сервис запущен, но зависимости еще не готовы",
  })
  async getReadiness() {
    const checks = {
      database: false,
      redis: false,
    };

    try {
      await this.dataSource.query("SELECT 1");
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      const pong = await this.redisService.ping();
      checks.redis = pong === "PONG";
    } catch {
      checks.redis = false;
    }

    const isReady = checks.database && checks.redis;
    const payload = {
      status: isReady ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    };

    if (!isReady) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }

  @Get("ping")
  @ApiOperation({ summary: "Простой ping эндпоинт" })
  @ApiResponse({
    status: 200,
    description: "Pong ответ",
  })
  ping() {
    return { message: "pong" };
  }
}
