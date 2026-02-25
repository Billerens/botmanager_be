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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FlowTemplatesService } from "./flow-templates.service";
import { FlowTemplateCategoriesService } from "./flow-template-categories.service";
import { CreateFlowTemplateDto } from "./dto/create-flow-template.dto";
import { UpdateFlowTemplateDto } from "./dto/update-flow-template.dto";
import { GalleryQueryDto } from "./dto/gallery-query.dto";
import { RequestDeletionDto } from "./dto/reject-template.dto";

interface AuthRequest extends Request {
  user: { id: string };
}

@Controller("flow-templates")
@UseGuards(JwtAuthGuard)
export class FlowTemplatesController {
  constructor(
    private readonly templatesService: FlowTemplatesService,
    private readonly categoriesService: FlowTemplateCategoriesService
  ) {}

  // ===== Галерея =====

  @Get("gallery")
  async getGallery(@Query() query: GalleryQueryDto) {
    return this.templatesService.getGallery(query);
  }

  @Get("gallery/:id")
  async getGalleryItem(@Param("id") id: string) {
    return this.templatesService.getGalleryItem(id);
  }

  // ===== Категории (публичные) =====

  @Get("categories")
  async getCategories() {
    return this.categoriesService.getActiveCategories();
  }

  // ===== Мои темплейты =====

  @Get("my")
  async getMyTemplates(@Req() req: AuthRequest) {
    return this.templatesService.getMyTemplates(req.user.id);
  }

  @Get("my/:id")
  async getMyTemplateById(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.templatesService.getMyTemplateById(req.user.id, id);
  }

  @Post()
  async create(
    @Req() req: AuthRequest,
    @Body() dto: CreateFlowTemplateDto
  ) {
    return this.templatesService.create(req.user.id, dto);
  }

  @Put(":id")
  async update(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() dto: UpdateFlowTemplateDto
  ) {
    return this.templatesService.update(req.user.id, id, dto);
  }

  @Delete(":id")
  async archive(@Req() req: AuthRequest, @Param("id") id: string) {
    await this.templatesService.archive(req.user.id, id);
    return { message: "Темплейт архивирован" };
  }

  @Post(":id/publish")
  async publish(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.templatesService.publish(req.user.id, id);
  }

  @Post(":id/request-deletion")
  async requestDeletion(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() dto: RequestDeletionDto
  ) {
    return this.templatesService.requestDeletion(req.user.id, id, dto.reason);
  }

  @Post(":id/apply")
  async trackApply(@Param("id") id: string) {
    await this.templatesService.trackApply(id);
    return { message: "Использование зафиксировано" };
  }
}
