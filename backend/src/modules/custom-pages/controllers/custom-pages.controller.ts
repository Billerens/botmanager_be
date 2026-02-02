import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
  Query,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, Public } from "../../auth/guards/jwt-auth.guard";
import { CustomPagesService } from "../services/custom-pages.service";
import { CustomPagePermissionsService } from "../custom-page-permissions.service";
import { CustomPageInvitationsService } from "../custom-page-invitations.service";
import {
  CreateCustomPageDto,
  UpdateCustomPageDto,
} from "../dto/custom-page.dto";
import { CustomPageResponseDto } from "../dto/custom-page-response.dto";
import {
  CreateCustomPageInvitationDto,
  AcceptCustomPageInvitationDto,
} from "../dto/custom-page-invitation.dto";
import { CustomPagePermissionGuard } from "../guards/custom-page-permission.guard";
import { CustomPagePermission } from "../decorators/custom-page-permission.decorator";
import { CustomPageEntity } from "../../../database/entities/custom-page-user-permission.entity";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";

@ApiTags("Кастомные страницы")
@Controller("custom-pages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomPagesController {
  constructor(
    private readonly customPagesService: CustomPagesService,
    private readonly customPagePermissionsService: CustomPagePermissionsService,
    private readonly customPageInvitationsService: CustomPageInvitationsService
  ) {}

  // ============================================================
  // CRUD операции
  // ============================================================

  @Post()
  @ApiOperation({ summary: "Создать кастомную страницу" })
  @ApiResponse({
    status: 201,
    description: "Страница создана",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Некорректные данные" })
  @ApiResponse({
    status: 409,
    description: "Slug или команда уже используются",
  })
  async create(
    @Request() req: any,
    @Body() createDto: CreateCustomPageDto
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.create(req.user.id, createDto);
  }

  @Get("check-slug/:slug")
  @ApiOperation({
    summary: "Проверить доступность slug для страницы",
    description:
      "Проверяет, свободен ли указанный slug. Можно указать excludeId для исключения текущей страницы при редактировании.",
  })
  @ApiParam({ name: "slug", description: "Slug для проверки" })
  @ApiQuery({
    name: "excludeId",
    required: false,
    description: "ID страницы для исключения из проверки",
  })
  @ApiResponse({
    status: 200,
    description: "Результат проверки",
    schema: {
      type: "object",
      properties: {
        available: { type: "boolean" },
        slug: { type: "string" },
        message: { type: "string" },
      },
    },
  })
  async checkSlugAvailability(
    @Param("slug") slug: string,
    @Query("excludeId") excludeId?: string
  ) {
    return this.customPagesService.checkSlugAvailability(slug, excludeId);
  }

  @Get()
  @ApiOperation({
    summary: "Получить все свои страницы пользователя (только владелец)",
  })
  @ApiResponse({
    status: 200,
    description: "Список страниц",
    type: [CustomPageResponseDto],
  })
  async findAll(@Request() req: any): Promise<CustomPageResponseDto[]> {
    return this.customPagesService.findAllByOwner(req.user.id);
  }

  @Get("shared")
  @ApiOperation({
    summary: "Получить кастомные страницы в управлении (свои + приглашённые)",
  })
  @ApiResponse({
    status: 200,
    description: "Список страниц",
    type: [CustomPageResponseDto],
  })
  async findAllShared(@Request() req: any): Promise<CustomPageResponseDto[]> {
    return this.customPagesService.findAllForUser(req.user.id);
  }

  @Get("by-bot/:botId")
  @ApiOperation({ summary: "Получить страницы по боту" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Список страниц бота",
    type: [CustomPageResponseDto],
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async findByBot(
    @Param("botId") botId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto[]> {
    return this.customPagesService.findAllByBot(botId, req.user.id);
  }

  @Get("by-shop/:shopId")
  @ApiOperation({ summary: "Получить страницы по магазину" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiResponse({
    status: 200,
    description: "Список страниц магазина",
    type: [CustomPageResponseDto],
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async findByShop(
    @Param("shopId") shopId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto[]> {
    return this.customPagesService.findAllByShop(shopId, req.user.id);
  }

  // ============================================================
  // Приглашения (глобальные — до :id)
  // ============================================================

  @Get("invitations/me")
  @ApiOperation({ summary: "Получить свои приглашения на кастомные страницы" })
  @ApiResponse({ status: 200, description: "Список приглашений" })
  async getMyInvitations(@Request() req: any) {
    return this.customPageInvitationsService.getUserInvitations(req.user.id);
  }

  @Get("invitations/by-token/:token")
  @Public()
  @ApiOperation({
    summary: "Получить информацию о приглашении по токену (публично)",
  })
  @ApiParam({ name: "token", description: "Токен приглашения" })
  @ApiResponse({ status: 200, description: "Информация о приглашении" })
  async getInvitationByToken(@Param("token") token: string) {
    return this.customPageInvitationsService.getInvitationByToken(token);
  }

  @Post("invitations/accept")
  @ApiOperation({ summary: "Принять приглашение" })
  @ApiResponse({ status: 200, description: "Приглашение принято" })
  @ApiResponse({
    status: 400,
    description: "Приглашение уже обработано или истекло",
  })
  async acceptInvitation(
    @Request() req: any,
    @Body() dto: AcceptCustomPageInvitationDto
  ) {
    await this.customPageInvitationsService.acceptInvitation(
      dto.token,
      req.user.id
    );
    return { message: "Приглашение принято" };
  }

  @Post("invitations/decline")
  @ApiOperation({ summary: "Отклонить приглашение" })
  @ApiResponse({ status: 200, description: "Приглашение отклонено" })
  async declineInvitation(
    @Request() req: any,
    @Body() dto: AcceptCustomPageInvitationDto
  ) {
    await this.customPageInvitationsService.declineInvitation(
      dto.token,
      req.user.id
    );
    return { message: "Приглашение отклонено" };
  }

  // ============================================================
  // Пользователи и приглашения страницы (:id/users, :id/invitations)
  // ============================================================

  @Get(":id/users")
  @UseGuards(CustomPagePermissionGuard)
  @CustomPagePermission(
    CustomPageEntity.CUSTOM_PAGE_USERS,
    PermissionAction.READ
  )
  @ApiOperation({ summary: "Список пользователей страницы" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({ status: 200, description: "Список пользователей" })
  @ApiResponse({ status: 403, description: "Нет прав" })
  async getPageUsers(@Param("id") id: string) {
    return this.customPagePermissionsService.getCustomPageUsers(id);
  }

  @Post(":id/users")
  @UseGuards(CustomPagePermissionGuard)
  @CustomPagePermission(
    CustomPageEntity.CUSTOM_PAGE_USERS,
    PermissionAction.CREATE
  )
  @ApiOperation({ summary: "Добавить пользователя к странице" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        displayName: { type: "string", nullable: true },
        permissions: { type: "object", nullable: true },
      },
      required: ["userId"],
    },
  })
  @ApiResponse({ status: 201, description: "Пользователь добавлен" })
  @ApiResponse({ status: 403, description: "Нет прав" })
  async addPageUser(
    @Param("id") id: string,
    @Body()
    body: {
      userId: string;
      displayName?: string;
      permissions?: Record<string, PermissionAction[]>;
    }
  ) {
    return this.customPagePermissionsService.addUserToCustomPage(
      id,
      body.userId,
      body.displayName,
      body.permissions as any
    );
  }

  @Delete(":id/users/:userId")
  @UseGuards(CustomPagePermissionGuard)
  @CustomPagePermission(
    CustomPageEntity.CUSTOM_PAGE_USERS,
    PermissionAction.DELETE
  )
  @ApiOperation({ summary: "Удалить пользователя со страницы" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiParam({ name: "userId", description: "ID пользователя" })
  @ApiResponse({ status: 200, description: "Пользователь удалён" })
  @ApiResponse({ status: 403, description: "Нет прав" })
  async removePageUser(
    @Param("id") id: string,
    @Param("userId") userId: string
  ) {
    await this.customPagePermissionsService.removeUserFromCustomPage(
      id,
      userId
    );
  }

  @Get(":id/invitations")
  @UseGuards(CustomPagePermissionGuard)
  @CustomPagePermission(
    CustomPageEntity.CUSTOM_PAGE_USERS,
    PermissionAction.READ
  )
  @ApiOperation({ summary: "Список приглашений страницы" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({ status: 200, description: "Список приглашений" })
  @ApiResponse({ status: 403, description: "Нет прав" })
  async getPageInvitations(@Param("id") id: string, @Request() req: any) {
    return this.customPageInvitationsService.getPageInvitations(
      id,
      req.user.id
    );
  }

  @Post(":id/invitations")
  @UseGuards(CustomPagePermissionGuard)
  @CustomPagePermission(
    CustomPageEntity.CUSTOM_PAGE_USERS,
    PermissionAction.CREATE
  )
  @ApiOperation({ summary: "Создать приглашение на страницу" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({ status: 201, description: "Приглашение создано" })
  @ApiResponse({ status: 403, description: "Нет прав" })
  async createPageInvitation(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: CreateCustomPageInvitationDto
  ) {
    return this.customPageInvitationsService.createInvitation(
      id,
      dto.telegramId,
      dto.permissions,
      req.user.id,
      dto.message
    );
  }

  @Delete(":id/invitations/:invitationId")
  @UseGuards(CustomPagePermissionGuard)
  @CustomPagePermission(
    CustomPageEntity.CUSTOM_PAGE_USERS,
    PermissionAction.DELETE
  )
  @ApiOperation({ summary: "Отменить приглашение" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiParam({ name: "invitationId", description: "ID приглашения" })
  @ApiResponse({ status: 200, description: "Приглашение отменено" })
  @ApiResponse({ status: 403, description: "Нет прав" })
  async cancelPageInvitation(
    @Param("id") id: string,
    @Param("invitationId") invitationId: string,
    @Request() req: any
  ) {
    await this.customPageInvitationsService.cancelInvitation(
      id,
      invitationId,
      req.user.id
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить страницу по ID" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({
    status: 200,
    description: "Страница найдена",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async findOne(
    @Param("id") id: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.findOne(id, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить страницу" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({
    status: 200,
    description: "Страница обновлена",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  @ApiResponse({
    status: 409,
    description: "Slug или команда уже используются",
  })
  async update(
    @Param("id") id: string,
    @Request() req: any,
    @Body() updateDto: UpdateCustomPageDto
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.update(id, req.user.id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить страницу" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({ status: 200, description: "Страница удалена" })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async remove(@Param("id") id: string, @Request() req: any): Promise<void> {
    return this.customPagesService.remove(id, req.user.id);
  }

  // ============================================================
  // Загрузка бандла
  // ============================================================

  @Post(":id/upload-bundle")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 250 * 1024 * 1024, // 250MB максимум
      },
      fileFilter: (_req, file, callback) => {
        if (
          file.mimetype === "application/zip" ||
          file.mimetype === "application/x-zip-compressed" ||
          file.originalname.endsWith(".zip")
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException("Разрешены только ZIP файлы"),
            false
          );
        }
      },
    })
  )
  @ApiOperation({ summary: "Загрузить ZIP-архив для static страницы" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "ZIP-архив с бандлом",
        },
      },
      required: ["file"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Бандл загружен",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Неверный формат файла" })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async uploadBundle(
    @Param("id") id: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File
  ): Promise<CustomPageResponseDto> {
    if (!file) {
      throw new BadRequestException("Файл не был загружен");
    }

    return this.customPagesService.uploadBundle(id, req.user.id, file.buffer);
  }

  // ============================================================
  // Привязка/отвязка
  // ============================================================

  @Post(":id/assign-bot/:botId")
  @ApiOperation({ summary: "Привязать страницу к боту" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Страница привязана к боту",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница или бот не найден" })
  @ApiResponse({ status: 409, description: "Команда уже используется" })
  async assignToBot(
    @Param("id") pageId: string,
    @Param("botId") botId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.assignToBot(pageId, botId, req.user.id);
  }

  @Post(":id/assign-shop/:shopId")
  @ApiOperation({ summary: "Привязать страницу к магазину" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiResponse({
    status: 200,
    description: "Страница привязана к магазину",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница или магазин не найден" })
  @ApiResponse({ status: 409, description: "Команда уже используется" })
  async assignToShop(
    @Param("id") pageId: string,
    @Param("shopId") shopId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.assignToShop(pageId, shopId, req.user.id);
  }

  @Delete(":id/unassign-bot")
  @ApiOperation({ summary: "Отвязать страницу от бота" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({
    status: 200,
    description: "Страница отвязана от бота",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async unassignFromBot(
    @Param("id") pageId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.unassignFromBot(pageId, req.user.id);
  }

  @Delete(":id/unassign-shop")
  @ApiOperation({ summary: "Отвязать страницу от магазина" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({
    status: 200,
    description: "Страница отвязана от магазина",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 403, description: "Нет прав доступа" })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async unassignFromShop(
    @Param("id") pageId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.unassignFromShop(pageId, req.user.id);
  }

  // ============================================================
  // УПРАВЛЕНИЕ СУБДОМЕНАМИ
  // ============================================================

  @Get(":id/subdomain/check/:slug")
  @ApiOperation({
    summary: "Проверить доступность slug для страницы (в контексте субдомена)",
  })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiParam({ name: "slug", description: "Проверяемый slug" })
  @ApiResponse({
    status: 200,
    description: "Результат проверки доступности slug",
    schema: {
      type: "object",
      properties: {
        available: { type: "boolean" },
        slug: { type: "string" },
        message: { type: "string" },
      },
    },
  })
  async checkSubdomainSlugAvailability(
    @Param("id") pageId: string,
    @Param("slug") slug: string
  ) {
    return this.customPagesService.checkSlugAvailability(slug, pageId);
  }

  @Patch(":id/subdomain")
  @ApiOperation({
    summary: "Установить или обновить slug страницы (субдомен)",
  })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          nullable: true,
          description: "Новый slug или null для удаления",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Slug обновлен, субдомен в процессе активации",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Неверный slug или конфликт" })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async updatePageSubdomain(
    @Param("id") pageId: string,
    @Body() body: { slug: string | null },
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.updateSlug(pageId, body.slug, req.user.id);
  }

  @Get(":id/subdomain/status")
  @ApiOperation({ summary: "Получить статус субдомена страницы" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({
    status: 200,
    description: "Статус субдомена",
    schema: {
      type: "object",
      properties: {
        slug: { type: "string", nullable: true },
        status: { type: "string", nullable: true },
        url: { type: "string", nullable: true },
        error: { type: "string", nullable: true },
        activatedAt: { type: "string", format: "date-time", nullable: true },
        estimatedWaitMessage: { type: "string", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async getSubdomainStatus(@Param("id") pageId: string, @Request() req: any) {
    return this.customPagesService.getSubdomainStatus(pageId, req.user.id);
  }

  @Post(":id/subdomain/retry")
  @ApiOperation({ summary: "Повторить активацию субдомена страницы" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({
    status: 200,
    description: "Активация субдомена перезапущена",
    type: CustomPageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Субдомен уже активен или нет slug",
  })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async retrySubdomainActivation(
    @Param("id") pageId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.retrySubdomainActivation(
      pageId,
      req.user.id
    );
  }

  @Delete(":id/subdomain")
  @ApiOperation({ summary: "Удалить субдомен страницы" })
  @ApiParam({ name: "id", description: "ID страницы" })
  @ApiResponse({
    status: 200,
    description: "Субдомен удалён",
    type: CustomPageResponseDto,
  })
  @ApiResponse({ status: 404, description: "Страница не найдена" })
  async removeSubdomain(
    @Param("id") pageId: string,
    @Request() req: any
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.updateSlug(pageId, null, req.user.id);
  }
}
