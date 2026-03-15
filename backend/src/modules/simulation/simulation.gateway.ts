import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../auth/auth.service";
import { User } from "../../database/entities/user.entity";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { SimulationService } from "./simulation.service";
import type { SimulationGuestPayload } from "./simulation.controller";

interface SimulationSocket extends Socket {
  user?: User;
  userId?: string;
  isGuest?: boolean;
  guestBotId?: string;
  sentBotConfigIds?: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3001",
      process.env.LANDING_URL || "http://localhost:3002",
    ],
    credentials: true,
  },
  namespace: "/simulation",
  transports: ["websocket", "polling"],
})
export class SimulationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SimulationGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly simulationService: SimulationService,
  ) {}

  async handleConnection(client: SimulationSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`[SIM] Клиент ${client.id} без токена`);
        client.emit("simulation:error", { message: "Требуется аутентификация" });
        client.disconnect();
        return;
      }

      const guestResult = this.authenticateGuest(token);
      if (guestResult) {
        client.isGuest = true;
        client.guestBotId = guestResult.botId;
        client.userId = `guest:${guestResult.botId}`;

        this.logger.log(
          `[SIM] Guest-клиент ${client.id} подключен (botId: ${guestResult.botId})`,
        );

        await this.emitBotConfig(client, guestResult.botId);
        return;
      }

      const user = await this.authenticateUser(token);
      if (!user) {
        this.logger.warn(`[SIM] Клиент ${client.id} не аутентифицирован`);
        client.emit("simulation:error", { message: "Невалидный токен" });
        client.disconnect();
        return;
      }

      client.user = user;
      client.userId = user.id;

      this.logger.log(`[SIM] Клиент ${client.id} подключен (user: ${user.id})`);

      const handshakeBotId = this.extractBotId(client);
      if (handshakeBotId) {
        await this.emitBotConfig(client, handshakeBotId);
      }
    } catch (error) {
      this.logger.error(`[SIM] Ошибка подключения ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: SimulationSocket) {
    this.simulationService.handleDisconnect(client.id);
    this.logger.log(`[SIM] Клиент ${client.id} отключен`);
  }

  @SubscribeMessage("simulation:start")
  async handleStart(
    @MessageBody() data: { botId: string; flowId?: string },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    if (!client.userId) {
      client.emit("simulation:error", { message: "Не аутентифицирован" });
      return;
    }

    if (client.isGuest && client.guestBotId && data.botId !== client.guestBotId) {
      client.emit("simulation:error", { message: "Доступ к этому боту запрещён" });
      return;
    }

    try {
      await this.emitBotConfig(client, data.botId);

      const { simulationId } = await this.simulationService.startSimulation(
        client,
        client.userId,
        data.botId,
        data.flowId,
      );

      client.emit("simulation:started", { simulationId });
      this.logger.log(`[SIM] Симуляция ${simulationId} запущена для бота ${data.botId}`);
    } catch (error) {
      this.logger.error(`[SIM] Ошибка старта: ${error.message}`);
      client.emit("simulation:error", { message: error.message });
    }
  }

  @SubscribeMessage("simulation:get_bot_config")
  async handleGetBotConfig(
    @MessageBody() data: { botId: string },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    if (!client.userId) {
      client.emit("simulation:error", { message: "Не аутентифицирован" });
      return;
    }

    if (!data?.botId) {
      client.emit("simulation:error", { message: "botId обязателен" });
      return;
    }

    if (client.isGuest && client.guestBotId && data.botId !== client.guestBotId) {
      client.emit("simulation:error", { message: "Доступ к этому боту запрещён" });
      return;
    }

    await this.emitBotConfig(client, data.botId, true);
  }

  @SubscribeMessage("simulation:message")
  async handleMessage(
    @MessageBody() data: { simulationId: string; text: string },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    if (!client.userId) {
      client.emit("simulation:error", { message: "Не аутентифицирован" });
      return;
    }

    try {
      await this.simulationService.processMessage(client, data.simulationId, data.text);
    } catch (error) {
      this.logger.error(`[SIM] Ошибка обработки сообщения: ${error.message}`);
      client.emit("simulation:error", { message: error.message });
    }
  }

  @SubscribeMessage("simulation:callback")
  async handleCallback(
    @MessageBody() data: { simulationId: string; callbackData: string },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    if (!client.userId) {
      client.emit("simulation:error", { message: "Не аутентифицирован" });
      return;
    }

    try {
      await this.simulationService.processCallback(client, data.simulationId, data.callbackData);
    } catch (error) {
      this.logger.error(`[SIM] Ошибка callback: ${error.message}`);
      client.emit("simulation:error", { message: error.message });
    }
  }

  @SubscribeMessage("simulation:endpoint_data")
  async handleEndpointData(
    @MessageBody() data: { simulationId: string; nodeId: string; data: Record<string, any> },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    if (!client.userId) {
      client.emit("simulation:error", { message: "Не аутентифицирован" });
      return;
    }

    try {
      await this.simulationService.processEndpointData(
        client,
        data.simulationId,
        data.nodeId,
        data.data,
      );
    } catch (error) {
      this.logger.error(`[SIM] Ошибка endpoint data: ${error.message}`);
      client.emit("simulation:error", { message: error.message });
    }
  }

  @SubscribeMessage("simulation:stop")
  handleStop(
    @MessageBody() data: { simulationId: string },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    this.simulationService.stopSimulation(data.simulationId);
    client.emit("simulation:ended");
    this.logger.log(`[SIM] Симуляция ${data.simulationId} остановлена`);
  }

  private extractToken(client: Socket): string | null {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (token && typeof token === "string") {
      return token;
    }

    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }

  private extractBotId(client: Socket): string | null {
    const botId = client.handshake.auth?.botId || client.handshake.query?.botId;
    if (botId && typeof botId === "string") {
      return botId;
    }
    return null;
  }

  private async emitBotConfig(
    client: SimulationSocket,
    botId: string,
    force = false,
  ): Promise<void> {
    if (!client.userId || !botId) {
      return;
    }

    if (!client.sentBotConfigIds) {
      client.sentBotConfigIds = new Set<string>();
    }

    if (!force && client.sentBotConfigIds.has(botId)) {
      return;
    }

    try {
      const config = await this.simulationService.getBotConfig(botId, client.userId);
      client.emit("simulation:bot_config", config);
      client.sentBotConfigIds.add(botId);
      this.logger.debug(`[SIM] Отправлен bot_config для botId=${botId} (socket: ${client.id})`);
    } catch (error) {
      this.logger.warn(
        `[SIM] Не удалось отправить bot_config для botId=${botId}: ${error.message}`,
      );
      client.emit("simulation:error", {
        message: `Не удалось загрузить конфигурацию бота: ${error.message}`,
      });
    }
  }

  private authenticateGuest(token: string): SimulationGuestPayload | null {
    try {
      const payload = this.jwtService.verify<SimulationGuestPayload>(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      if (
        payload?.type === "simulation_guest" &&
        payload?.scope === "simulation_only" &&
        payload?.botId
      ) {
        return payload;
      }

      return null;
    } catch {
      return null;
    }
  }

  private async authenticateUser(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      if (!payload?.sub) {
        return null;
      }

      return await this.authService.validateJwtPayload(payload);
    } catch (error) {
      this.logger.error(`[SIM] Ошибка аутентификации: ${error.message}`);
      return null;
    }
  }
}
