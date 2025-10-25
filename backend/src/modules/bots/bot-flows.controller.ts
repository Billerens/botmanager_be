import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { UseGuards } from "@nestjs/common";
import { BotFlowsService } from "./bot-flows.service";
import { CreateFlowDto, UpdateFlowDto } from "./dto/flow.dto";

@ApiTags("Диалоги бота")
@Controller("bots/:botId/flows")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BotFlowsController {
  constructor(private readonly botFlowsService: BotFlowsService) {}

  @Post()
  @ApiOperation({ summary: "Создать новый диалог" })
  @ApiResponse({ status: 201, description: "Диалог создан" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async create(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Body() createFlowDto: CreateFlowDto,
    @Request() req: any
  ) {
    return this.botFlowsService.createFlow(createFlowDto, botId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Получить все диалоги бота" })
  @ApiResponse({ status: 200, description: "Список диалогов получен" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async findAll(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Request() req: any
  ) {
    return this.botFlowsService.findAllFlows(botId, req.user.id);
  }

  @Get(":flowId")
  @ApiOperation({ summary: "Получить диалог по ID" })
  @ApiResponse({ status: 200, description: "Диалог получен" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Диалог не найден" })
  async findOne(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("flowId", ParseUUIDPipe) flowId: string,
    @Request() req: any
  ) {
    return this.botFlowsService.findOneFlow(flowId, botId, req.user.id);
  }

  @Patch(":flowId")
  @ApiOperation({ summary: "Обновить диалог" })
  @ApiResponse({ status: 200, description: "Диалог обновлен" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Диалог не найден" })
  async update(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("flowId", ParseUUIDPipe) flowId: string,
    @Body() updateFlowDto: UpdateFlowDto,
    @Request() req: any
  ) {
    return this.botFlowsService.updateFlow(
      flowId,
      updateFlowDto,
      botId,
      req.user.id
    );
  }

  @Delete(":flowId")
  @ApiOperation({ summary: "Удалить диалог" })
  @ApiResponse({ status: 200, description: "Диалог удален" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Диалог не найден" })
  async remove(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("flowId", ParseUUIDPipe) flowId: string,
    @Request() req: any
  ) {
    await this.botFlowsService.removeFlow(flowId, botId, req.user.id);
    return { message: "Диалог удален" };
  }

  @Post(":flowId/activate")
  @ApiOperation({ summary: "Активировать диалог" })
  @ApiResponse({ status: 200, description: "Диалог активирован" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Диалог не найден" })
  async activate(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("flowId", ParseUUIDPipe) flowId: string,
    @Request() req: any
  ) {
    return this.botFlowsService.activateFlow(flowId, botId, req.user.id);
  }

  @Post(":flowId/deactivate")
  @ApiOperation({ summary: "Деактивировать диалог" })
  @ApiResponse({ status: 200, description: "Диалог деактивирован" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  @ApiResponse({ status: 404, description: "Диалог не найден" })
  async deactivate(
    @Param("botId", ParseUUIDPipe) botId: string,
    @Param("flowId", ParseUUIDPipe) flowId: string,
    @Request() req: any
  ) {
    return this.botFlowsService.deactivateFlow(flowId, botId, req.user.id);
  }
}
