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

/**
 * Аутентифицированный сокет симуляции
 */
interface SimulationSocket extends Socket {
  user?: User;
  userId?: string;
}

/**
 * WebSocket Gateway для симуляции botflow.
 *
 * Namespace: /simulation (изолирован от основного WS)
 * Аутентификация: JWT (через query.token или Authorization header)
 *
 * Поддерживаемые события:
 *   Client → Server: simulation:start, simulation:message, simulation:callback,
 *                    simulation:endpoint_data, simulation:stop
 *   Server → Client: simulation:started, simulation:bot_message, simulation:bot_photo,
 *                    simulation:bot_document, simulation:typing, simulation:endpoint_waiting,
 *                    simulation:periodic_tick, simulation:error, simulation:ended
 */
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

  /**
   * Обработка подключения — аутентификация через JWT
   */
  async handleConnection(client: SimulationSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`[SIM] Клиент ${client.id} без токена`);
        client.emit("simulation:error", { message: "Требуется аутентификация" });
        client.disconnect();
        return;
      }

      const user = await this.authenticate(token);
      if (!user) {
        this.logger.warn(`[SIM] Клиент ${client.id} не аутентифицирован`);
        client.emit("simulation:error", { message: "Невалидный токен" });
        client.disconnect();
        return;
      }

      client.user = user;
      client.userId = user.id;

      this.logger.log(`[SIM] Клиент ${client.id} подключен (user: ${user.id})`);
    } catch (error) {
      this.logger.error(`[SIM] Ошибка подключения ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Обработка отключения — очистка сессий
   */
  handleDisconnect(client: SimulationSocket) {
    this.simulationService.handleDisconnect(client.id);
    this.logger.log(`[SIM] Клиент ${client.id} отключен`);
  }

  /**
   * Запуск симуляции
   */
  @SubscribeMessage("simulation:start")
  async handleStart(
    @MessageBody() data: { botId: string; flowId?: string },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    if (!client.userId) {
      client.emit("simulation:error", { message: "Не аутентифицирован" });
      return;
    }

    try {
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

  /**
   * Получение сообщения «от пользователя»
   */
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

  /**
   * Нажатие inline-кнопки
   */
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

  /**
   * Данные для endpoint-узла
   */
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

  /**
   * Остановка симуляции
   */
  @SubscribeMessage("simulation:stop")
  handleStop(
    @MessageBody() data: { simulationId: string },
    @ConnectedSocket() client: SimulationSocket,
  ) {
    this.simulationService.stopSimulation(data.simulationId);
    client.emit("simulation:ended");
    this.logger.log(`[SIM] Симуляция ${data.simulationId} остановлена`);
  }

  // ==================== Private ====================

  private extractToken(client: Socket): string | null {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (token && typeof token === "string") return token;

    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }

  private async authenticate(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });
      if (!payload) return null;
      return await this.authService.validateJwtPayload(payload);
    } catch (error) {
      this.logger.error(`[SIM] Ошибка аутентификации: ${error.message}`);
      return null;
    }
  }
}
