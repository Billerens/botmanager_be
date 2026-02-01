import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("Health")
@Controller()
export class HealthController {
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
