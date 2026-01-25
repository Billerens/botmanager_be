import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { AdminS3Service, FileInfo, FileEntityInfo, S3Stats } from "../services/admin-s3.service";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";

@Controller("admin/s3")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminS3Controller {
  constructor(private readonly adminS3Service: AdminS3Service) {}

  /**
   * Получает список файлов с пагинацией и фильтрами
   * GET /admin/s3/files?page=1&limit=50&prefix=products&search=image
   */
  @Get("files")
  async getFiles(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("prefix") prefix?: string,
    @Query("search") search?: string
  ) {
    return await this.adminS3Service.getFiles({
      page,
      limit,
      prefix,
      search,
    });
  }

  /**
   * Получает статистику хранилища
   * GET /admin/s3/stats
   */
  @Get("stats")
  async getStats(): Promise<S3Stats> {
    return await this.adminS3Service.getStats();
  }

  /**
   * Получает связанную сущность по файлу
   * GET /admin/s3/files/:fileUrl/entity
   */
  @Get("files/:fileUrl/entity")
  async getFileEntity(
    @Param("fileUrl") fileUrl: string
  ): Promise<FileEntityInfo | null> {
    const decodedFileUrl = decodeURIComponent(fileUrl);
    return await this.adminS3Service.getFileEntity(decodedFileUrl);
  }

  /**
   * Получает файлы, связанные с сущностью
   * GET /admin/s3/entities/:entityType/:entityId/files
   */
  @Get("entities/:entityType/:entityId/files")
  async getEntityFiles(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string
  ): Promise<{ files: FileInfo[] }> {
    const files = await this.adminS3Service.getEntityFiles(
      entityType,
      entityId
    );
    return { files };
  }
}
