import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotificationService } from "./services/notification.service";
import {
  NotificationListDto,
  NotificationSummaryDto,
  GetNotificationsDto,
  MarkNotificationsReadDto,
} from "./dto/notification.dto";

/**
 * Контроллер для работы с уведомлениями
 */
@Controller("api/notifications")
@UseGuards(JwtAuthGuard)
export class WebSocketNotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Получает список уведомлений пользователя
   */
  @Get()
  async getNotifications(
    @Request() req,
    @Query() query: GetNotificationsDto
  ): Promise<NotificationListDto> {
    const userId = req.user.id;
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const unreadOnly = query.unreadOnly || false;

    return this.notificationService.getNotifications(
      userId,
      limit,
      offset,
      unreadOnly
    );
  }

  /**
   * Получает сводку уведомлений (количество по типам)
   */
  @Get("summary")
  async getSummary(@Request() req): Promise<NotificationSummaryDto[]> {
    const userId = req.user.id;
    return this.notificationService.getNotificationsSummary(userId);
  }

  /**
   * Получает количество непрочитанных уведомлений
   */
  @Get("unread-count")
  async getUnreadCount(@Request() req): Promise<{ count: number }> {
    const userId = req.user.id;
    const count =
      await this.notificationService.getUnreadNotificationsCount(userId);
    return { count };
  }

  /**
   * Помечает уведомления как прочитанные
   */
  @Post("mark-read")
  async markAsRead(
    @Request() req,
    @Body() body: MarkNotificationsReadDto
  ): Promise<{ updatedCount: number }> {
    const userId = req.user.id;
    const updatedCount = await this.notificationService.markNotificationsAsRead(
      userId,
      body.all ? undefined : body.notificationIds
    );

    // Отправляем обновление счетчика и сводки для синхронизации кэша на фронтенде
    if (updatedCount > 0) {
      await this.notificationService.sendUnreadCountUpdate(userId);
      await this.notificationService.sendNotificationsSummary(userId);
    }

    return { updatedCount };
  }
}
