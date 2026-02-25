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
} from "@nestjs/common";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { StylePresetsService } from "../../style-presets/style-presets.service";
import { CreateStylePresetDto } from "../../style-presets/dto/create-style-preset.dto";
import { UpdateStylePresetDto } from "../../style-presets/dto/update-style-preset.dto";
import { StylePresetStatus } from "../../../database/entities/style-preset.entity";
import {
  RejectPresetDto,
  RejectDeletionDto,
  PlatformChoiceDto,
} from "../../style-presets/dto/style-preset-actions.dto";

@Controller("admin/style-presets")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminStylePresetsController {
  constructor(private readonly presetsService: StylePresetsService) {}

  @Get()
  async getAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
    @Query("status") status?: StylePresetStatus,
    @Query("target") target?: string,
    @Query("authorId") authorId?: string,
  ) {
    return this.presetsService.adminGetAll({
      page,
      limit,
      search,
      status,
      target,
      authorId,
    });
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.presetsService.adminGetById(id);
  }

  @Post()
  async create(@Body() dto: CreateStylePresetDto) {
    return this.presetsService.adminCreate(dto);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateStylePresetDto) {
    return this.presetsService.adminUpdate(id, dto);
  }

  @Delete(":id")
  async archive(@Param("id") id: string) {
    await this.presetsService.adminArchive(id);
    return { message: "Пресет архивирован" };
  }

  @Post(":id/approve")
  async approve(@Param("id") id: string) {
    return this.presetsService.approve(id);
  }

  @Post(":id/reject")
  async reject(@Param("id") id: string, @Body() dto: RejectPresetDto) {
    return this.presetsService.reject(id, dto.reason);
  }

  @Post(":id/approve-deletion")
  async approveDeletion(@Param("id") id: string) {
    return this.presetsService.approveDeletion(id);
  }

  @Post(":id/reject-deletion")
  async rejectDeletion(@Param("id") id: string, @Body() dto: RejectDeletionDto) {
    return this.presetsService.rejectDeletion(id, dto.reason);
  }

  @Post(":id/platform-choice")
  async setPlatformChoice(
    @Param("id") id: string,
    @Body() dto: PlatformChoiceDto,
  ) {
    return this.presetsService.setPlatformChoice(id, dto.isPlatformChoice);
  }
}
