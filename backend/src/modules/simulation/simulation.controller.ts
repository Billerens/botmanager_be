import { Controller, Post, Headers, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

/** Payload гостевого JWT для симуляции (scope: simulation_only) */
export interface SimulationGuestPayload {
  type: "simulation_guest";
  botId: string;
  scope: "simulation_only";
}

/**
 * Controller для выдачи гостевых JWT-токенов симуляции.
 *
 * POST /api/simulation/guest-token
 *   Header: x-simulation-key — API-ключ из SIMULATION_API_KEY
 *
 * Возвращает короткоживущий JWT с type=simulation_guest,
 * который позволяет только запускать симуляцию конкретного бота.
 * Токен НЕ содержит userId и не пройдёт валидацию на обычных endpoints.
 */
@Controller("simulation")
export class SimulationController {
  private readonly logger = new Logger(SimulationController.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Post("guest-token")
  async getGuestToken(
    @Headers("x-simulation-key") apiKey: string,
  ) {
    const expectedKey = this.configService.get<string>("SIMULATION_API_KEY");
    const botId = this.configService.get<string>("SIMULATION_BOT_ID");

    if (!expectedKey || !botId) {
      this.logger.warn("[SIM] guest-token: SIMULATION_API_KEY или SIMULATION_BOT_ID не настроены");
      throw new HttpException(
        "Simulation not configured",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new HttpException("Invalid API key", HttpStatus.UNAUTHORIZED);
    }

    // Создаём JWT с ограниченным scope
    const payload: SimulationGuestPayload = {
      type: "simulation_guest",
      botId,
      scope: "simulation_only",
    };

    const token = this.jwtService.sign(payload, {
      expiresIn: "15m", // Короткий TTL — 15 минут
    });

    this.logger.log(`[SIM] Выдан guest-token для бота ${botId}`);

    return { token, botId };
  }
}
