import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MessagesService } from "./messages.service";

@ApiTags("messages")
@Controller("messages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("bot/:botId")
  @ApiOperation({ summary: "Получить историю сообщений бота" })
  @ApiResponse({ status: 200, description: "История сообщений получена" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async getBotMessages(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 50,
    @Query("type") type?: "incoming" | "outgoing"
  ) {
    return this.messagesService.getBotMessages(botId, req.user.id, {
      page,
      limit,
      type,
    });
  }

  @Get("bot/:botId/dialog/:chatId")
  @ApiOperation({ summary: "Получить диалог с конкретным пользователем" })
  @ApiResponse({ status: 200, description: "Диалог получен" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Бот или диалог не найден" })
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
  @ApiResponse({ status: 200, description: "Статистика получена" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async getBotMessageStats(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any
  ) {
    return this.messagesService.getBotMessageStats(botId, req.user.id);
  }
}
