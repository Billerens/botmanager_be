import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { AuthService } from "../auth/auth.service";
import { User } from "../../database/entities/user.entity";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

/**
 * Интерфейс для аутентифицированного сокета
 */
interface AuthenticatedSocket extends Socket {
  user?: User;
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  },
  namespace: "/",
  transports: ["websocket", "polling"],
})
@Injectable()
export class BotManagerWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BotManagerWebSocketGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private socketToUser = new Map<string, string>(); // socketId -> userId

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private authService: AuthService
  ) {}

  /**
   * Инициализация Gateway после создания сервера
   */
  async afterInit(server: Server) {
    this.logger.log("WebSocket Gateway инициализирован");

    // Настройка Redis адаптера для масштабируемости
    try {
      const redisConfig = this.configService.get("redis");
      const pubClient = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log("Redis адаптер для Socket.IO настроен успешно");
    } catch (error) {
      this.logger.warn(
        `Не удалось настроить Redis адаптер: ${error.message}. Продолжаем работу без масштабируемости.`
      );
    }
  }

  /**
   * Обработка подключения клиента
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Проверяем аутентификацию
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Клиент ${client.id} подключился без токена`);
        client.disconnect();
        return;
      }

      // Валидируем токен
      const user = await this.authenticate(token);
      if (!user) {
        this.logger.warn(`Клиент ${client.id} не прошел аутентификацию`);
        client.disconnect();
        return;
      }

      // Сохраняем информацию о пользователе
      client.user = user;
      client.userId = user.id;
      client.join(`user-${user.id}`); // Автоматически присоединяем к комнате пользователя

      // Отслеживаем подключенных пользователей
      this.connectedUsers.set(user.id, client.id);
      this.socketToUser.set(client.id, user.id);

      this.logger.log(
        `Клиент ${client.id} подключен (Пользователь: ${user.id}, ${user.telegramUsername || "без username"})`
      );
    } catch (error) {
      this.logger.error(
        `Ошибка при подключении клиента ${client.id}: ${error.message}`,
        error.stack
      );
      client.disconnect();
    }
  }

  /**
   * Обработка отключения клиента
   */
  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      this.connectedUsers.delete(userId);
      this.socketToUser.delete(client.id);
      this.logger.log(`Клиент ${client.id} отключен (Пользователь: ${userId})`);
    } else {
      this.logger.log(`Клиент ${client.id} отключен`);
    }
  }

  /**
   * Извлекает токен из запроса
   */
  private extractToken(client: Socket): string | null {
    // Проверяем query параметры
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (token && typeof token === "string") {
      return token;
    }

    // Проверяем Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Аутентифицирует пользователя по JWT токену
   */
  private async authenticate(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      if (!payload) {
        return null;
      }

      const user = await this.authService.validateJwtPayload(payload);
      return user;
    } catch (error) {
      this.logger.error(`Ошибка аутентификации: ${error.message}`);
      return null;
    }
  }

  /**
   * Подписка на комнату
   */
  @SubscribeMessage("join-room")
  handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    if (!client.userId) {
      throw new UnauthorizedException("Пользователь не аутентифицирован");
    }

    client.join(data.room);
    this.logger.log(
      `Клиент ${client.id} (Пользователь: ${client.userId}) присоединился к комнате ${data.room}`
    );
  }

  /**
   * Отписка от комнаты
   */
  @SubscribeMessage("leave-room")
  handleLeaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    if (!client.userId) {
      throw new UnauthorizedException("Пользователь не аутентифицирован");
    }

    client.leave(data.room);
    this.logger.log(
      `Клиент ${client.id} (Пользователь: ${client.userId}) покинул комнату ${data.room}`
    );
  }

  /**
   * Получение статистики подключений
   */
  @SubscribeMessage("get-stats")
  handleGetStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      throw new UnauthorizedException("Пользователь не аутентифицирован");
    }

    return {
      connectedUsers: this.connectedUsers.size,
      socketId: client.id,
      userId: client.userId,
    };
  }

  // Методы для отправки уведомлений

  /**
   * Отправляет сообщение в комнату
   */
  emitToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
    this.logger.debug(`Сообщение отправлено в комнату ${room}: ${event}`);
  }

  /**
   * Отправляет сообщение всем подключенным пользователям
   */
  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`Сообщение отправлено всем: ${event}`);
  }

  /**
   * Отправляет сообщение конкретному пользователю
   */
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user-${userId}`).emit(event, data);
    this.logger.debug(`Сообщение отправлено пользователю ${userId}: ${event}`);
  }

  /**
   * Проверяет, подключен ли пользователь
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Получает количество подключенных пользователей
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}
