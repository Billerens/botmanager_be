import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotificationSettingsService } from "./services/notification-settings.service";
import {
  NotificationSettingsResponseDto,
  UpdateNotificationSettingsDto,
} from "./dto/notification-settings.dto";

@ApiTags("WebSocket Settings")
@Controller("api/notifications/settings")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WebSocketSettingsController {
  constructor(
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Получить настройки уведомлений пользователя",
    description:
      "Возвращает список всех доступных типов уведомлений и текущие настройки пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Настройки уведомлений успешно получены",
    type: NotificationSettingsResponseDto,
  })
  async getNotificationSettings(@Request() req): Promise<NotificationSettingsResponseDto> {
    return this.notificationSettingsService.getUserNotificationSettings(req.user.id);
  }

  @Put()
  @ApiOperation({
    summary: "Обновить настройки уведомлений",
    description:
      "Обновляет настройки уведомлений для текущего пользователя. Можно обновить только часть настроек.",
  })
  @ApiResponse({
    status: 200,
    description: "Настройки уведомлений успешно обновлены",
    type: NotificationSettingsResponseDto,
  })
  async updateNotificationSettings(
    @Request() req,
    @Body() updateDto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponseDto> {
    return this.notificationSettingsService.updateUserNotificationSettings(
      req.user.id,
      updateDto.settings,
    );
  }

  @Get("types")
  @ApiOperation({
    summary: "Получить список всех типов уведомлений",
    description: "Возвращает список всех доступных типов уведомлений с описаниями",
  })
  @ApiResponse({
    status: 200,
    description: "Список типов уведомлений",
  })
  async getNotificationTypes() {
    return {
      types: this.notificationSettingsService.getAvailableNotificationTypes(),
    };
  }
}

