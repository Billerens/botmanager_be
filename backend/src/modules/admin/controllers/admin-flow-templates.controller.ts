import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { Admin } from "../../../database/entities/admin.entity";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { AdminActionLogService } from "../services/admin-action-log.service";
import {
  AdminActionType,
  AdminActionLevel,
} from "../../../database/entities/admin-action-log.entity";
import { FlowTemplatesService } from "../../flow-templates/flow-templates.service";
import { CreateFlowTemplateDto } from "../../flow-templates/dto/create-flow-template.dto";
import { UpdateFlowTemplateDto } from "../../flow-templates/dto/update-flow-template.dto";
import {
  RejectTemplateDto,
  RejectDeletionDto,
  PlatformChoiceDto,
} from "../../flow-templates/dto/reject-template.dto";
import { FlowTemplateStatus } from "../../../database/entities/flow-template.entity";

interface AdminRequest extends Request {
  user: Admin;
}

@Controller("admin/flow-templates")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminFlowTemplatesController {
  constructor(
    private readonly templatesService: FlowTemplatesService,
    private readonly actionLogService: AdminActionLogService
  ) {}

  @Get()
  async findAll(
    @Req() req: AdminRequest,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
    @Query("search") search?: string,
    @Query("status") status?: FlowTemplateStatus,
    @Query("type") type?: string,
    @Query("categoryId") categoryId?: string,
    @Query("authorId") authorId?: string
  ) {
    return this.templatesService.adminGetAll({
      page: Number(page),
      limit: Number(limit),
      search,
      status,
      type,
      categoryId,
      authorId,
    });
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.templatesService.adminGetById(id);
  }

  @Post()
  async create(
    @Req() req: AdminRequest,
    @Body() dto: CreateFlowTemplateDto
  ) {
    const result = await this.templatesService.adminCreate(dto);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Создан системный шаблон flow: "${dto.name}"`,
      { entityType: "flow_template", entityId: result.id, request: req }
    );

    return result;
  }

  @Put(":id")
  async update(
    @Req() req: AdminRequest,
    @Param("id") id: string,
    @Body() dto: UpdateFlowTemplateDto
  ) {
    const result = await this.templatesService.adminUpdate(id, dto);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Обновлён шаблон flow: "${result.name}"`,
      { entityType: "flow_template", entityId: id, request: req }
    );

    return result;
  }

  @Delete(":id")
  async archive(@Req() req: AdminRequest, @Param("id") id: string) {
    await this.templatesService.adminArchive(id);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Архивирован шаблон flow: ${id}`,
      {
        level: AdminActionLevel.WARNING,
        entityType: "flow_template",
        entityId: id,
        request: req,
      }
    );

    return { message: "Темплейт архивирован" };
  }

  @Post(":id/approve")
  async approve(@Req() req: AdminRequest, @Param("id") id: string) {
    const result = await this.templatesService.approve(id);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Одобрена публикация шаблона flow: "${result.name}"`,
      { entityType: "flow_template", entityId: id, request: req }
    );

    return result;
  }

  @Post(":id/reject")
  async reject(
    @Req() req: AdminRequest,
    @Param("id") id: string,
    @Body() dto: RejectTemplateDto
  ) {
    const result = await this.templatesService.reject(id, dto.reason);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Отклонена публикация шаблона flow: "${result.name}". Причина: ${dto.reason}`,
      { entityType: "flow_template", entityId: id, request: req }
    );

    return result;
  }

  @Post(":id/approve-deletion")
  async approveDeletion(@Req() req: AdminRequest, @Param("id") id: string) {
    const result = await this.templatesService.approveDeletion(id);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Одобрено удаление шаблона flow: "${result.name}"`,
      {
        level: AdminActionLevel.WARNING,
        entityType: "flow_template",
        entityId: id,
        request: req,
      }
    );

    return result;
  }

  @Post(":id/reject-deletion")
  async rejectDeletion(
    @Req() req: AdminRequest,
    @Param("id") id: string,
    @Body() dto: RejectDeletionDto
  ) {
    const result = await this.templatesService.rejectDeletion(id, dto.reason);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Отклонено удаление шаблона flow: "${result.name}"`,
      { entityType: "flow_template", entityId: id, request: req }
    );

    return result;
  }

  @Post(":id/platform-choice")
  async setPlatformChoice(
    @Req() req: AdminRequest,
    @Param("id") id: string,
    @Body() dto: PlatformChoiceDto
  ) {
    const result = await this.templatesService.setPlatformChoice(
      id,
      dto.isPlatformChoice
    );

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `${dto.isPlatformChoice ? "Установлен" : "Снят"} "Выбор платформы" для шаблона: "${result.name}"`,
      { entityType: "flow_template", entityId: id, request: req }
    );

    return result;
  }

  @Post(":id/duplicate")
  async duplicate(@Req() req: AdminRequest, @Param("id") id: string) {
    const result = await this.templatesService.duplicate(id);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SETTINGS_UPDATE,
      `Дублирован шаблон flow: ${id} → ${result.id}`,
      { entityType: "flow_template", entityId: result.id, request: req }
    );

    return result;
  }
}
