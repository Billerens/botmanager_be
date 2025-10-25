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
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
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
import { MessagesService } from "./messages.service";
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

@ApiTags("messages")
@Controller("messages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

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
