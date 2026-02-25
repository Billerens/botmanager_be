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
import { StylePresetsService } from "./style-presets.service";
import { CreateStylePresetDto } from "./dto/create-style-preset.dto";
import { UpdateStylePresetDto } from "./dto/update-style-preset.dto";
import { GalleryQueryDto } from "./dto/gallery-query.dto";
import { RequestDeletionDto } from "./dto/style-preset-actions.dto";

interface AuthRequest extends Request {
  user: { id: string };
}

@Controller("style-presets")
@UseGuards(JwtAuthGuard)
export class StylePresetsController {
  constructor(private readonly presetsService: StylePresetsService) {}

  // ===== Галерея =====

  @Get("gallery")
  async getGallery(@Query() query: GalleryQueryDto) {
    return this.presetsService.getGallery(query);
  }

  @Get("gallery/:id")
  async getGalleryItem(@Param("id") id: string) {
    return this.presetsService.getGalleryItem(id);
  }

  // ===== Мои пресеты =====

  @Get("my")
  async getMyPresets(@Req() req: AuthRequest) {
    return this.presetsService.getMyPresets(req.user.id);
  }

  @Get("my/:id")
  async getMyPresetById(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.presetsService.getMyPresetById(req.user.id, id);
  }

  @Post()
  async create(@Req() req: AuthRequest, @Body() dto: CreateStylePresetDto) {
    return this.presetsService.create(req.user.id, dto);
  }

  @Put(":id")
  async update(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() dto: UpdateStylePresetDto,
  ) {
    return this.presetsService.update(req.user.id, id, dto);
  }

  @Delete(":id")
  async archive(@Req() req: AuthRequest, @Param("id") id: string) {
    await this.presetsService.archive(req.user.id, id);
    return { message: "Пресет архивирован" };
  }

  @Post(":id/publish")
  async publish(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.presetsService.publish(req.user.id, id);
  }

  @Post(":id/request-deletion")
  async requestDeletion(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() dto: RequestDeletionDto,
  ) {
    return this.presetsService.requestDeletion(req.user.id, id, dto.reason);
  }

  @Post(":id/apply")
  async trackApply(@Param("id") id: string) {
    await this.presetsService.trackApply(id);
    return { message: "Использование зафиксировано" };
  }
}
