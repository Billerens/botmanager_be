import {
  Controller,
  Get,
  Delete,
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
   * Получает список папок верхнего уровня
   * GET /admin/s3/folders
   */
  @Get("folders")
  async getFolders(): Promise<{ folders: string[] }> {
    const folders = await this.adminS3Service.getFolders();
    return { folders };
  }

  /**
   * Получает подпапки для указанной папки (оптимизированная версия для дерева)
   * GET /admin/s3/subfolders?prefix=products&limit=200&search=test
   */
  @Get("subfolders")
  async getSubfolders(
    @Query("prefix") prefix: string,
    @Query("limit", new DefaultValuePipe(200), ParseIntPipe) limit: number,
    @Query("search") search?: string
  ) {
    return await this.adminS3Service.getSubfolders({
      prefix,
      limit,
      search,
    });
  }

  /**
   * Получает содержимое папки (файлы и подпапки) с пагинацией
   * GET /admin/s3/files?page=1&limit=50&prefix=products&search=image&loadEntities=false
   */
  @Get("files")
  async getFiles(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("prefix") prefix?: string,
    @Query("search") search?: string,
    @Query("loadEntities", new DefaultValuePipe(true)) loadEntities?: boolean
  ) {
    return await this.adminS3Service.getFiles({
      page,
      limit,
      prefix,
      search,
      loadEntities: loadEntities !== false,
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
    if (!fileUrl || fileUrl.trim() === "") {
      return null;
    }
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

  /**
   * Удаляет файл или папку из S3
   * DELETE /admin/s3/files/:fileKeyOrUrl
   */
  @Delete("files/:fileKeyOrUrl")
  async deleteFileOrFolder(
    @Param("fileKeyOrUrl") fileKeyOrUrl: string
  ): Promise<{ deleted: boolean; message: string }> {
    const decoded = decodeURIComponent(fileKeyOrUrl);
    return await this.adminS3Service.deleteFileOrFolder(decoded);
  }
}
