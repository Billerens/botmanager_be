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
import {
  Logger,
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createClient, RedisClientType } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { AuthService } from "../auth/auth.service";
import { User } from "../../database/entities/user.entity";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { NotificationService } from "./services/notification.service";

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
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BotManagerWebSocketGateway.name);
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId> (поддержка множественных подключений)
  private socketToUser = new Map<string, string>(); // socketId -> userId
  private redisPubClient: RedisClientType | null = null;
  private redisSubClient: RedisClientType | null = null;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private authService: AuthService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService
  ) {}

  /**
   * Инициализация Gateway после создания сервера
   */
  async afterInit(server: Server) {
    this.logger.log("WebSocket Gateway инициализирован");

    // Настройка Redis адаптера для масштабируемости
    try {
      const redisConfig = this.configService.get("redis");
      this.redisPubClient = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
        },
        password: redisConfig.password,
        database: redisConfig.db,
      }) as RedisClientType;
      this.redisSubClient = this.redisPubClient.duplicate() as RedisClientType;

      await Promise.all([
        this.redisPubClient.connect(),
        this.redisSubClient.connect(),
      ]);

      server.server.adapter(
        createAdapter(this.redisPubClient, this.redisSubClient)
      );
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

      // Отслеживаем подключенных пользователей (поддержка множественных подключений)
      if (!this.connectedUsers.has(user.id)) {
        this.connectedUsers.set(user.id, new Set());
      }
      this.connectedUsers.get(user.id)!.add(client.id);
      this.socketToUser.set(client.id, user.id);

      const connectionCount = this.connectedUsers.get(user.id)!.size;
      this.logger.log(
        `Клиент ${client.id} подключен (Пользователь: ${user.id}, ${user.telegramUsername || "без username"}, активных подключений: ${connectionCount})`
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
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        // Удаляем запись пользователя только если не осталось активных подключений
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
          this.logger.log(
            `Клиент ${client.id} отключен (Пользователь: ${userId}, больше нет активных подключений)`
          );
        } else {
          this.logger.log(
            `Клиент ${client.id} отключен (Пользователь: ${userId}, осталось активных подключений: ${userSockets.size})`
          );
        }
      }
      this.socketToUser.delete(client.id);
    } else {
      this.logger.log(`Клиент ${client.id} отключен`);
    }
  }

  /**
   * Закрытие соединений при завершении работы модуля
   */
  async onModuleDestroy() {
    try {
      if (this.redisPubClient) {
        await this.redisPubClient.quit();
        this.logger.log("Redis pub клиент для Socket.IO адаптера закрыт");
      }
      if (this.redisSubClient) {
        await this.redisSubClient.quit();
        this.logger.log("Redis sub клиент для Socket.IO адаптера закрыт");
      }
    } catch (error) {
      this.logger.error(
        `Ошибка закрытия Redis клиентов Socket.IO адаптера: ${error.message}`,
        error.stack
      );
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

  /**
   * Обработка запроса клиента на получение накопленных уведомлений
   * Клиент отправляет это событие, когда готов принимать уведомления
   */
  @SubscribeMessage("client-ready")
  async handleClientReady(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      throw new UnauthorizedException("Пользователь не аутентифицирован");
    }

    this.logger.log(
      `Клиент ${client.id} (Пользователь: ${client.userId}) готов принимать уведомления`
    );

    // Отправляем сводку по накопленным уведомлениям
    await this.sendNotificationsSummary(client.userId);

    return { success: true };
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
   * Отправляется всем активным подключениям пользователя через комнату
   */
  emitToUser(userId: string, event: string, data: any) {
    const connectionCount = this.getUserConnectionsCount(userId);
    this.server.to(`user-${userId}`).emit(event, data);
    this.logger.debug(
      `Сообщение отправлено пользователю ${userId}: ${event} (активных подключений: ${connectionCount})`
    );
  }

  /**
   * Проверяет, подключен ли пользователь (есть ли хотя бы одно активное подключение)
   */
  isUserConnected(userId: string): boolean {
    const userSockets = this.connectedUsers.get(userId);
    return userSockets !== undefined && userSockets.size > 0;
  }

  /**
   * Получает количество уникальных подключенных пользователей
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Получает количество активных подключений для конкретного пользователя
   */
  getUserConnectionsCount(userId: string): number {
    const userSockets = this.connectedUsers.get(userId);
    return userSockets ? userSockets.size : 0;
  }

  /**
   * Отправляет сводку по накопленным уведомлениям пользователю
   */
  private async sendNotificationsSummary(userId: string): Promise<void> {
    try {
      const unreadCount =
        await this.notificationService.getUnreadNotificationsCount(userId);
      if (unreadCount > 0) {
        const summary =
          await this.notificationService.getNotificationsSummary(userId);

        // Отправляем событие с количеством непрочитанных и сводкой
        this.emitToUser(userId, "notifications.summary", {
          unreadCount,
          summary,
        });

        this.logger.log(
          `Отправлена сводка: ${unreadCount} непрочитанных уведомлений пользователю ${userId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки сводки уведомлений пользователю ${userId}: ${error.message}`,
        error.stack
      );
    }
  }
}
