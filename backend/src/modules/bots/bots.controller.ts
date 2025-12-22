import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  NotFoundException,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiQuery,
  getSchemaPath,
} from "@nestjs/swagger";

import { BotsService } from "./bots.service";
import { JwtAuthGuard, Public } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "./guards/bot-permission.guard";
import { CreateBotDto, UpdateBotDto } from "./dto/bot.dto";
import { BotResponseDto, BotStatsResponseDto } from "./dto/bot-response.dto";
import { ButtonSettingsDto } from "./dto/command-button-settings.dto";
import { BotPermissionsService } from "./bot-permissions.service";
import { BotInvitationsService } from "./bot-invitations.service";
import {
  CreateBotUserDto,
  UpdateBotUserPermissionsDto,
  BotUserResponseDto,
} from "./dto/bot-user.dto";
import {
  CreateBotInvitationDto,
  BotInvitationResponseDto,
} from "./dto/bot-invitation.dto";
import { BotPermission } from "./decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";

@ApiTags("Боты")
@Controller("bots")
@UseGuards(JwtAuthGuard, BotPermissionGuard)
@ApiBearerAuth()
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly botPermissionsService: BotPermissionsService,
    private readonly botInvitationsService: BotInvitationsService
  ) {}

  @Post()
  @ApiOperation({ summary: "Создать нового бота" })
  @ApiResponse({
    status: 201,
    description: "Бот успешно создан",
    schema: {
      $ref: getSchemaPath(BotResponseDto),
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные или токен" })
  async create(@Body() createBotDto: CreateBotDto, @Request() req) {
    return this.botsService.create(createBotDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Получить список всех ботов пользователя" })
  @ApiResponse({
    status: 200,
    description: "Список ботов получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(BotResponseDto),
      },
    },
  })
  async findAll(@Request() req) {
    return this.botsService.findAll(req.user.id);
  }

  @Get("check-slug/:slug")
  @ApiOperation({
    summary: "Проверить доступность slug для бота (бронирование)",
    description:
      "Проверяет, свободен ли указанный slug. Можно указать excludeId для исключения текущего бота при редактировании.",
  })
  @ApiQuery({
    name: "excludeId",
    required: false,
    description: "ID бота для исключения из проверки",
  })
  @ApiResponse({
    status: 200,
    description: "Результат проверки",
    schema: {
      type: "object",
      properties: {
        available: { type: "boolean", description: "Slug доступен" },
        slug: { type: "string", description: "Нормализованный slug" },
        message: { type: "string", description: "Сообщение" },
      },
    },
  })
  async checkSlug(
    @Param("slug") slug: string,
    @Query("excludeId") excludeId?: string
  ) {
    return this.botsService.checkSlugAvailability(slug, excludeId);
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Получить статистику бота" })
  @ApiResponse({
    status: 200,
    description: "Статистика бота получена",
    schema: {
      $ref: getSchemaPath(BotStatsResponseDto),
    },
  })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  @BotPermission(BotEntity.ANALYTICS, PermissionAction.READ)
  async getStats(@Param("id") id: string, @Request() req) {
    return this.botsService.getStats(id, req.user.id);
  }

  @Patch(":id/activate")
  @ApiOperation({ summary: "Активировать бота" })
  @ApiResponse({ status: 200, description: "Бот активирован" })
  @ApiResponse({
    status: 400,
    description: "Бот уже активен или ошибка активации",
  })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  @BotPermission(BotEntity.BOT_SETTINGS, PermissionAction.UPDATE)
  async activate(@Param("id") id: string, @Request() req) {
    return this.botsService.activate(id, req.user.id);
  }

  @Patch(":id/deactivate")
  @ApiOperation({ summary: "Деактивировать бота" })
  @ApiResponse({ status: 200, description: "Бот деактивирован" })
  @ApiResponse({ status: 400, description: "Бот уже неактивен" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  @BotPermission(BotEntity.BOT_SETTINGS, PermissionAction.UPDATE)
  async deactivate(@Param("id") id: string, @Request() req) {
    return this.botsService.deactivate(id, req.user.id);
  }

  // Эндпоинт shop-settings удалён - используйте ShopsController
  // PATCH /shops/:shopId для обновления настроек магазина

  @Patch(":id/booking-settings")
  @ApiOperation({ summary: "Обновить настройки бронирования бота" })
  @ApiResponse({ status: 200, description: "Настройки бронирования обновлены" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  @BotPermission(BotEntity.BOOKING_SETTINGS, PermissionAction.UPDATE)
  async updateBookingSettings(
    @Param("id") id: string,
    @Body()
    bookingSettings: {
      slug?: string;
      isBookingEnabled?: boolean;
      bookingTitle?: string;
      bookingDescription?: string;
      bookingLogoUrl?: string;
      bookingCustomStyles?: string;
      bookingButtonTypes?: string[];
      bookingButtonSettings?: ButtonSettingsDto;
      bookingSettings?: any;
    },
    @Request() req
  ) {
    return this.botsService.updateBookingSettings(
      id,
      bookingSettings,
      req.user.id
    );
  }

  @Get("shared")
  @ApiOperation({ summary: "Получить боты доступные пользователю" })
  @ApiResponse({
    status: 200,
    description: "Список ботов получен",
  })
  async getSharedBots(@Request() req) {
    return await this.botPermissionsService.getUserBots(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить бота по ID" })
  @ApiResponse({ status: 200, description: "Бот найден" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  @BotPermission(BotEntity.BOT_SETTINGS, PermissionAction.READ)
  async findOne(@Param("id") id: string, @Request() req) {
    return this.botsService.findOne(id, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить бота" })
  @ApiResponse({ status: 200, description: "Бот обновлен" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async update(
    @Param("id") id: string,
    @Body() updateBotDto: UpdateBotDto,
    @Request() req
  ) {
    return this.botsService.update(id, updateBotDto, req.user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить бота" })
  @ApiResponse({ status: 200, description: "Бот удален" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async remove(@Param("id") id: string, @Request() req) {
    return this.botsService.remove(id, req.user.id);
  }

  // ========== Эндпоинты для управления пользователями бота ==========

  @Get(":id/users")
  @ApiOperation({ summary: "Получить список пользователей бота" })
  @ApiResponse({
    status: 200,
    description: "Список пользователей получен",
    schema: {
      type: "array",
      items: { $ref: getSchemaPath(BotUserResponseDto) },
    },
  })
  @BotPermission(BotEntity.BOT_USERS, PermissionAction.READ)
  async getBotUsers(@Param("id") botId: string) {
    const users = await this.botPermissionsService.getBotUsers(botId);
    return users.map((user) => ({
      id: user.id,
      botId: user.botId,
      userId: user.userId,
      displayName: user.displayName,
      permissions: user.permissions,
      createdAt: user.createdAt,
      user: user.user
        ? {
            id: user.user.id,
            telegramId: user.user.telegramId,
            telegramUsername: user.user.telegramUsername,
            firstName: user.user.firstName,
            lastName: user.user.lastName,
          }
        : undefined,
    }));
  }

  @Post(":id/users")
  @ApiOperation({ summary: "Добавить пользователя к боту" })
  @ApiResponse({
    status: 201,
    description: "Пользователь добавлен к боту",
    schema: { $ref: getSchemaPath(BotUserResponseDto) },
  })
  @BotPermission(BotEntity.BOT_USERS, PermissionAction.CREATE)
  async addUserToBot(
    @Param("id") botId: string,
    @Body() dto: CreateBotUserDto,
    @Request() req
  ) {
    // Для добавления пользователя нужен его ID, а не telegramId
    // Сначала найдем пользователя по telegramId или создадим нового
    const user = await this.botPermissionsService.addUserToBot(
      botId,
      dto.telegramId, // Пока что передаем telegramId как userId для тестирования
      dto.displayName,
      dto.permissions
    );

    // Устанавливаем разрешения
    await this.botPermissionsService.setBulkPermissions(
      botId,
      user.userId,
      dto.permissions,
      req.user.id
    );

    return {
      id: user.id,
      botId: user.botId,
      userId: user.userId,
      displayName: user.displayName,
      permissions: user.permissions,
      createdAt: user.createdAt,
    };
  }

  @Put(":id/users/:userId/permissions")
  @ApiOperation({ summary: "Обновить разрешения пользователя на боте" })
  @ApiResponse({
    status: 200,
    description: "Разрешения обновлены",
  })
  @BotPermission(BotEntity.BOT_USERS, PermissionAction.UPDATE)
  async updateUserPermissions(
    @Param("id") botId: string,
    @Param("userId") botUserId: string,
    @Body() dto: UpdateBotUserPermissionsDto,
    @Request() req
  ) {
    // Находим пользователя бота по ID записи bot_users
    const botUser = await this.botPermissionsService.findBotUserById(botUserId);
    if (!botUser || botUser.botId !== botId) {
      throw new NotFoundException("Пользователь бота не найден");
    }

    await this.botPermissionsService.setBulkPermissions(
      botId,
      botUser.userId,
      dto.permissions,
      req.user.id
    );
    return { message: "Разрешения обновлены" };
  }

  @Delete(":id/users/:userId")
  @ApiOperation({ summary: "Удалить пользователя из бота" })
  @ApiResponse({
    status: 200,
    description: "Пользователь удален из бота",
  })
  @BotPermission(BotEntity.BOT_USERS, PermissionAction.DELETE)
  async removeUserFromBot(
    @Param("id") botId: string,
    @Param("userId") botUserId: string
  ) {
    // Находим пользователя бота по ID записи bot_users
    const botUser = await this.botPermissionsService.findBotUserById(botUserId);
    if (!botUser || botUser.botId !== botId) {
      throw new NotFoundException("Пользователь бота не найден");
    }

    await this.botPermissionsService.removeUserFromBot(botId, botUser.userId);
    return { message: "Пользователь удален из бота" };
  }

  @Get(":id/my-permissions")
  @ApiOperation({ summary: "Получить свои разрешения на боте" })
  @ApiResponse({
    status: 200,
    description: "Разрешения получены",
  })
  async getMyPermissions(@Param("id") botId: string, @Request() req) {
    return await this.botPermissionsService.getUserPermissions(
      req.user.id,
      botId
    );
  }

  // ========== Эндпоинты для приглашений ==========

  @Post(":id/invitations")
  @ApiOperation({ summary: "Пригласить пользователя к боту" })
  @ApiResponse({
    status: 201,
    description: "Приглашение отправлено",
    schema: { $ref: getSchemaPath(BotInvitationResponseDto) },
  })
  @BotPermission(BotEntity.BOT_USERS, PermissionAction.CREATE)
  async createInvitation(
    @Param("id") botId: string,
    @Body() dto: CreateBotInvitationDto,
    @Request() req
  ) {
    const invitation = await this.botInvitationsService.createInvitation(
      botId,
      dto.telegramId,
      dto.permissions,
      req.user.id,
      dto.message
    );

    return {
      id: invitation.id,
      botId: invitation.botId,
      invitedTelegramId: invitation.invitedTelegramId,
      invitedUserId: invitation.invitedUserId,
      status: invitation.status,
      permissions: invitation.permissions,
      invitedByUserId: invitation.invitedByUserId,
      invitationToken: invitation.invitationToken,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      bot: invitation.bot
        ? {
            id: invitation.bot.id,
            name: invitation.bot.name,
            username: invitation.bot.username,
          }
        : undefined,
      invitedByUser: invitation.invitedByUser
        ? {
            id: invitation.invitedByUser.id,
            firstName: invitation.invitedByUser.firstName,
            lastName: invitation.invitedByUser.lastName,
          }
        : undefined,
    };
  }

  @Get(":id/invitations")
  @ApiOperation({ summary: "Получить приглашения бота" })
  @ApiResponse({
    status: 200,
    description: "Список приглашений получен",
    schema: {
      type: "array",
      items: { $ref: getSchemaPath(BotInvitationResponseDto) },
    },
  })
  @BotPermission(BotEntity.BOT_USERS, PermissionAction.READ)
  async getBotInvitations(@Param("id") botId: string, @Request() req) {
    const invitations = await this.botInvitationsService.getBotInvitations(
      botId,
      req.user.id
    );
    return invitations.map((invitation) => ({
      id: invitation.id,
      botId: invitation.botId,
      invitedTelegramId: invitation.invitedTelegramId,
      invitedUserId: invitation.invitedUserId,
      status: invitation.status,
      permissions: invitation.permissions,
      invitedByUserId: invitation.invitedByUserId,
      invitationToken: invitation.invitationToken,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      bot: invitation.bot
        ? {
            id: invitation.bot.id,
            name: invitation.bot.name,
            username: invitation.bot.username,
          }
        : undefined,
      invitedByUser: invitation.invitedByUser
        ? {
            id: invitation.invitedByUser.id,
            firstName: invitation.invitedByUser.firstName,
            lastName: invitation.invitedByUser.lastName,
          }
        : undefined,
      invitedUser: invitation.invitedUser
        ? {
            id: invitation.invitedUser.id,
            telegramId: invitation.invitedUser.telegramId,
            telegramUsername: invitation.invitedUser.telegramUsername,
            firstName: invitation.invitedUser.firstName,
            lastName: invitation.invitedUser.lastName,
          }
        : undefined,
    }));
  }

  @Delete(":id/invitations/:invitationId")
  @ApiOperation({ summary: "Отменить приглашение" })
  @ApiResponse({
    status: 200,
    description: "Приглашение отменено",
  })
  @BotPermission(BotEntity.BOT_USERS, PermissionAction.DELETE)
  async cancelInvitation(
    @Param("id") botId: string,
    @Param("invitationId") invitationId: string,
    @Request() req
  ) {
    await this.botInvitationsService.cancelInvitation(
      botId,
      invitationId,
      req.user.id
    );
    return { message: "Приглашение отменено" };
  }

  @Get("invitations/:token")
  @Public()
  @ApiOperation({ summary: "Получить информацию о приглашении по токену" })
  @ApiResponse({
    status: 200,
    description: "Информация о приглашении",
  })
  async getInvitationByToken(@Param("token") token: string) {
    return await this.botInvitationsService.getInvitationByToken(token);
  }

  @Post("invitations/:token/accept")
  @ApiOperation({ summary: "Принять приглашение" })
  @ApiResponse({
    status: 200,
    description: "Приглашение принято",
  })
  async acceptInvitation(@Param("token") token: string, @Request() req) {
    await this.botInvitationsService.acceptInvitation(token, req.user.id);
    return { message: "Приглашение принято" };
  }

  @Post("invitations/:token/decline")
  @ApiOperation({ summary: "Отклонить приглашение" })
  @ApiResponse({
    status: 200,
    description: "Приглашение отклонено",
  })
  async declineInvitation(@Param("token") token: string, @Request() req) {
    await this.botInvitationsService.declineInvitation(token, req.user.id);
    return { message: "Приглашение отклонено" };
  }

  @Get("my-invitations")
  @ApiOperation({ summary: "Получить свои приглашения" })
  @ApiResponse({
    status: 200,
    description: "Список приглашений получен",
  })
  async getMyInvitations(@Request() req) {
    const invitations = await this.botInvitationsService.getUserInvitations(
      req.user.id
    );
    return invitations.map((invitation) => ({
      id: invitation.id,
      botId: invitation.botId,
      invitedTelegramId: invitation.invitedTelegramId,
      status: invitation.status,
      permissions: invitation.permissions,
      invitedByUserId: invitation.invitedByUserId,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      bot: invitation.bot
        ? {
            id: invitation.bot.id,
            name: invitation.bot.name,
            username: invitation.bot.username,
          }
        : undefined,
      invitedByUser: invitation.invitedByUser
        ? {
            id: invitation.invitedByUser.id,
            firstName: invitation.invitedByUser.firstName,
            lastName: invitation.invitedByUser.lastName,
          }
        : undefined,
    }));
  }
}
