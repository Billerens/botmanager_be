import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  getSchemaPath,
} from "@nestjs/swagger";

import { LeadsService } from "./leads.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateLeadDto, UpdateLeadDto } from "./dto/lead.dto";
import {
  LeadResponseDto,
  LeadStatsResponseDto,
  ErrorResponseDto,
  DeleteResponseDto,
} from "./dto/lead-response.dto";

@ApiTags("Заявки")
@Controller("leads")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: "Создать заявку" })
  @ApiResponse({
    status: 201,
    description: "Заявка создана",
    schema: {
      $ref: getSchemaPath(LeadResponseDto),
    },
  })
  async create(@Body() createLeadDto: CreateLeadDto) {
    return this.leadsService.create(createLeadDto);
  }

  @Get("bot/:botId")
  @ApiOperation({ summary: "Получить заявки бота" })
  @ApiResponse({
    status: 200,
    description: "Список заявок получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(LeadResponseDto),
      },
    },
  })
  async findByBot(
    @Param("botId") botId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 50
  ) {
    return this.leadsService.findAll(botId, page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить заявку по ID" })
  @ApiResponse({
    status: 200,
    description: "Заявка найдена",
    schema: {
      $ref: getSchemaPath(LeadResponseDto),
    },
  })
  async findOne(@Param("id") id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить заявку" })
  @ApiResponse({
    status: 200,
    description: "Заявка обновлена",
    schema: {
      $ref: getSchemaPath(LeadResponseDto),
    },
  })
  async update(@Param("id") id: string, @Body() updateLeadDto: UpdateLeadDto) {
    return this.leadsService.update(id, updateLeadDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить заявку" })
  @ApiResponse({
    status: 200,
    description: "Заявка удалена",
    schema: {
      $ref: getSchemaPath(DeleteResponseDto),
    },
  })
  async remove(@Param("id") id: string) {
    return this.leadsService.delete(id);
  }

  @Get("bot/:botId/stats")
  @ApiOperation({ summary: "Получить статистику заявок бота" })
  @ApiResponse({
    status: 200,
    description: "Статистика заявок получена",
    schema: {
      $ref: getSchemaPath(LeadStatsResponseDto),
    },
  })
  async getStats(@Param("botId") botId: string) {
    return this.leadsService.getStats(botId);
  }
}
