import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { Admin } from "../../../database/entities/admin.entity";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { AdminActionLogService } from "../services/admin-action-log.service";
import { AdminActionType } from "../../../database/entities/admin-action-log.entity";
import { FlowTemplateCategoriesService } from "../../flow-templates/flow-template-categories.service";
import { UpsertCategoryDto } from "../../flow-templates/dto/upsert-category.dto";

interface AdminRequest extends Request {
  user: Admin;
}

@Controller("admin/flow-template-categories")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminFlowTemplateCategoriesController {
  constructor(
    private readonly categoriesService: FlowTemplateCategoriesService,
    private readonly actionLogService: AdminActionLogService
  ) {}

  @Get()
  async findAll() {
    return this.categoriesService.getAllCategories();
  }

  @Post()
  async create(@Req() req: AdminRequest, @Body() dto: UpsertCategoryDto) {
    const result = await this.categoriesService.createCategory(dto);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.FLOW_TEMPLATE_CATEGORY_CREATE,
      `Создана категория шаблонов flow: "${dto.slug}"`,
      {
        entityType: "flow_template_category",
        entityId: result.id,
        request: req,
      }
    );

    return result;
  }

  @Put(":id")
  async update(
    @Req() req: AdminRequest,
    @Param("id") id: string,
    @Body() dto: UpsertCategoryDto
  ) {
    const result = await this.categoriesService.updateCategory(id, dto);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.FLOW_TEMPLATE_CATEGORY_UPDATE,
      `Обновлена категория шаблонов flow: "${result.slug}"`,
      {
        entityType: "flow_template_category",
        entityId: id,
        request: req,
      }
    );

    return result;
  }

  @Delete(":id")
  async delete(@Req() req: AdminRequest, @Param("id") id: string) {
    await this.categoriesService.deleteCategory(id);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.FLOW_TEMPLATE_CATEGORY_DELETE,
      `Деактивирована категория шаблонов flow: ${id}`,
      {
        entityType: "flow_template_category",
        entityId: id,
        request: req,
      }
    );

    return { message: "Категория деактивирована" };
  }
}
