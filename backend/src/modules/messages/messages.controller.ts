import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  getSchemaPath,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../bots/guards/bot-permission.guard";
import { BotPermission } from "../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";
import { MessagesService } from "./messages.service";
import { TelegramService } from "../telegram/telegram.service";
import { BroadcastDto } from "./dto/broadcast.dto";
import {
  MessageResponseDto,
  BroadcastResponseDto,
  MessageStatsResponseDto,
  DialogResponseDto,
  GroupResponseDto,
  UserResponseDto,
  DialogStatsResponseDto,
  BroadcastStatusResponseDto,
  ErrorResponseDto,
} from "./dto/message-response.dto";

@ApiTags("Сообщения")
@Controller("messages")
@UseGuards(JwtAuthGuard, BotPermissionGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly telegramService: TelegramService
  ) {}

  @Get("bot/:botId")
  @ApiOperation({ summary: "Получить историю сообщений бота" })
  @ApiResponse({
    status: 200,
    description: "История сообщений получена",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(MessageResponseDto),
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.READ)
  async getBotMessages(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 50,
    @Query("type") type?: "incoming" | "outgoing",
    @Query("search") search?: string
  ) {
    return this.messagesService.getBotMessages(botId, req.user.id, {
      page,
      limit,
      type,
      search,
    });
  }

  @Get("bot/:botId/dialog/:chatId")
  @ApiOperation({ summary: "Получить диалог с конкретным пользователем" })
  @ApiResponse({
    status: 200,
    description: "Диалог получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(MessageResponseDto),
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот или диалог не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.READ)
  async getDialog(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("chatId") chatId: string,
    @Request() req: any,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 100
  ) {
    return this.messagesService.getDialog(botId, chatId, req.user.id, {
      page,
      limit,
    });
  }

  @Get("bot/:botId/stats")
  @ApiOperation({ summary: "Получить статистику сообщений бота" })
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
    schema: {
      $ref: getSchemaPath(MessageStatsResponseDto),
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.ANALYTICS, PermissionAction.READ)
  async getBotMessageStats(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any
  ) {
    return this.messagesService.getBotMessageStats(botId, req.user.id);
  }

  @Get("bot/:botId/dialogs")
  @ApiOperation({
    summary: "Получить список диалогов бота (сгруппированные по пользователям)",
  })
  @ApiResponse({
    status: 200,
    description: "Список диалогов получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(DialogResponseDto),
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.READ)
  async getBotDialogs(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
    @Query("search") search?: string,
    @Query("sortBy")
    sortBy: "lastActivity" | "messageCount" | "createdAt" = "lastActivity",
    @Query("sortOrder") sortOrder: "asc" | "desc" = "desc",
    @Query("chatType") chatType?: "private" | "group" | "supergroup" | "channel"
  ) {
    return this.messagesService.getBotDialogs(botId, req.user.id, {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      chatType,
    });
  }

  @Get("bot/:botId/groups")
  @ApiOperation({ summary: "Получить групповые чаты бота" })
  @ApiResponse({
    status: 200,
    description: "Групповые чаты получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(GroupResponseDto),
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.READ)
  async getBotGroups(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 50,
    @Query("search") search?: string,
    @Query("sortBy")
    sortBy: "lastActivity" | "messageCount" | "createdAt" = "lastActivity",
    @Query("sortOrder") sortOrder: "asc" | "desc" = "desc"
  ) {
    return this.messagesService.getBotGroups(botId, req.user.id, {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });
  }

  @Get("bot/:botId/dialog-stats")
  @ApiOperation({ summary: "Получить статистику диалогов бота" })
  @ApiResponse({
    status: 200,
    description: "Статистика диалогов получена",
    schema: {
      $ref: getSchemaPath(DialogStatsResponseDto),
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.ANALYTICS, PermissionAction.READ)
  async getBotDialogStats(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any
  ) {
    return this.messagesService.getBotDialogStats(botId, req.user.id);
  }

  @Delete("bot/:botId/dialog/:chatId")
  @ApiOperation({ summary: "Удалить диалог с пользователем" })
  @ApiResponse({
    status: 200,
    description: "Диалог удален",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Диалог успешно удален",
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот или диалог не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.DELETE)
  async deleteDialog(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("chatId") chatId: string,
    @Request() req: any
  ) {
    return this.messagesService.deleteDialog(botId, chatId, req.user.id);
  }

  @Get("bot/:botId/users")
  @ApiOperation({ summary: "Получить список пользователей бота" })
  @ApiResponse({
    status: 200,
    description: "Список пользователей получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(UserResponseDto),
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.READ)
  async getBotUsers(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string
  ) {
    // Преобразуем строковые параметры в числа с значениями по умолчанию
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    // Валидация значений
    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException("Page must be a positive number");
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException("Limit must be between 1 and 100");
    }

    return this.messagesService.getBotUsers(botId, req.user.id, {
      page: pageNum,
      limit: limitNum,
      search,
    });
  }

  @Get("bot/:botId/media/:fileId")
  @ApiOperation({ summary: "Получить медиафайл по fileId (streaming proxy)" })
  @ApiResponse({
    status: 200,
    description: "Медиафайл получен",
    content: {
      "image/*": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
      "video/*": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
      "audio/*": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
      "application/*": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот или файл не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.READ)
  async getMediaFile(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("fileId") fileId: string,
    @Request() req: any,
    @Res() res: Response
  ) {
    const fileInfo = await this.messagesService.getMediaFileInfo(
      botId,
      req.user.id,
      fileId
    );
    if (!fileInfo) {
      throw new NotFoundException("Файл не найден");
    }

    try {
      // Получаем stream от Telegram API
      const telegramResponse = await this.telegramService.getFileStream(
        fileInfo.token,
        fileInfo.filePath
      );

      // Устанавливаем заголовки для правильной отдачи файла
      res.setHeader(
        "Content-Type",
        fileInfo.mimeType || "application/octet-stream"
      );
      if (fileInfo.fileName) {
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${fileInfo.fileName}"`
        );
      }
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Кэшируем на год

      // Проксируем stream напрямую клиенту без загрузки в память
      telegramResponse.data.pipe(res);
    } catch (error) {
      console.error("Ошибка проксирования файла:", error);
      if (!res.headersSent) {
        throw new NotFoundException("Ошибка получения файла");
      }
    }
  }

  @Post("bot/:botId/broadcast")
  @UseInterceptors(FileInterceptor("image"))
  @ApiOperation({ summary: "Отправить рассылку" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 200,
    description: "Рассылка отправлена",
    schema: {
      $ref: getSchemaPath(BroadcastStatusResponseDto),
    },
  })
  @ApiResponse({
    status: 401,
    description: "Неавторизован",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.MESSAGES, PermissionAction.CREATE)
  async sendBroadcast(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any,
    @Body() body: any,
    @UploadedFile() image?: Express.Multer.File
  ) {
    // Парсим JSON данные из FormData
    let recipients;
    let buttons;

    try {
      recipients = JSON.parse(body.recipients || "{}");
      buttons = body.buttons ? JSON.parse(body.buttons) : undefined;
    } catch (error) {
      throw new BadRequestException(
        "Неверный формат данных получателей или кнопок"
      );
    }

    const broadcastData: BroadcastDto = {
      text: body.text,
      image: image,
      buttons: buttons,
      recipients: recipients,
    };

    return this.messagesService.sendBroadcast(
      botId,
      req.user.id,
      broadcastData
    );
  }
}
