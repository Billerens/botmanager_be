import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtService } from "@nestjs/jwt";
import { PublicApiKeyGuard, ApiKeyContext } from "./guards/public-api-key.guard";
import {
  PublicCustomDataService,
  PublicUserContext,
  PublicFindParams,
  PublicCreateDto,
  PublicUpdateDto,
} from "./public-custom-data.service";
import { ApiKeyContext as ApiKeyContextType } from "./public-api-key.service";
import { PublicUserJwtPayload } from "../public-auth/public-auth.service";

/**
 * Публичный контроллер для доступа к кастомным данным
 * Аутентификация через API Key (заголовок X-API-Key)
 * Опциональная авторизация пользователя через Telegram initData или browser session
 */
@ApiTags("Public Custom Data")
@ApiHeader({
  name: "X-API-Key",
  description: "Публичный API ключ владельца данных",
  required: true,
})
@UseGuards(PublicApiKeyGuard)
@Controller("public/data")
export class PublicCustomDataController {
  private readonly logger = new Logger(PublicCustomDataController.name);

  constructor(
    private readonly publicCustomDataService: PublicCustomDataService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Извлечь контекст пользователя из заголовков запроса
   * Поддерживает:
   * 1. Telegram initData (x-telegram-init-data)
   * 2. JWT токен браузерной сессии (Authorization: Bearer ...)
   */
  private extractUserContext(
    telegramInitData?: string,
    authorizationHeader?: string,
  ): PublicUserContext {
    // 1. Попытка извлечь данные из Telegram initData
    if (telegramInitData) {
      try {
        const params = new URLSearchParams(telegramInitData);
        const userJson = params.get("user");
        if (userJson) {
          const user = JSON.parse(userJson);
          return {
            userId: `tg_${user.id}`, // Префикс для различия с браузерными пользователями
            userName: user.first_name || user.username,
            isAuthenticated: true,
          };
        }
      } catch (error) {
        this.logger.debug("Не удалось распарсить Telegram initData");
      }
    }

    // 2. Попытка извлечь данные из JWT токена браузерной сессии
    if (authorizationHeader?.startsWith("Bearer ")) {
      try {
        const token = authorizationHeader.substring(7);
        const payload = this.jwtService.verify<PublicUserJwtPayload>(token);
        
        // Проверяем, что это токен публичного пользователя
        if (payload.type === "public") {
          return {
            userId: payload.sub,
            userEmail: payload.email,
            isAuthenticated: true,
          };
        }
      } catch (error) {
        this.logger.debug("Не удалось верифицировать JWT токен");
      }
    }

    return {
      isAuthenticated: false,
    };
  }

  // ========================================================================
  // КОЛЛЕКЦИИ
  // ========================================================================

  @Get("collections")
  @ApiOperation({ summary: "Получить список доступных коллекций" })
  @ApiResponse({ status: 200, description: "Список коллекций" })
  async getCollections(
    @ApiKeyContext() apiKeyContext: ApiKeyContextType,
    @Headers("x-telegram-init-data") telegramInitData?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userContext = this.extractUserContext(telegramInitData, authorization);
    return this.publicCustomDataService.getPublicCollections(
      apiKeyContext,
      userContext,
    );
  }

  @Get("collections/:collectionName")
  @ApiOperation({ summary: "Получить схему коллекции" })
  @ApiParam({ name: "collectionName", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Схема коллекции" })
  @ApiResponse({ status: 404, description: "Коллекция не найдена" })
  async getCollectionSchema(
    @ApiKeyContext() apiKeyContext: ApiKeyContextType,
    @Param("collectionName") collectionName: string,
    @Headers("x-telegram-init-data") telegramInitData?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userContext = this.extractUserContext(telegramInitData, authorization);
    return this.publicCustomDataService.getCollectionSchema(
      apiKeyContext,
      collectionName,
      userContext,
    );
  }

  // ========================================================================
  // ДАННЫЕ
  // ========================================================================

  @Get(":collection")
  @ApiOperation({ summary: "Получить список записей коллекции" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiQuery({ name: "limit", required: false, description: "Лимит записей (макс 100)" })
  @ApiQuery({ name: "offset", required: false, description: "Смещение" })
  @ApiQuery({ name: "sortBy", required: false, description: "Поле для сортировки" })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiQuery({ name: "search", required: false, description: "Поиск по titleField" })
  @ApiQuery({ name: "filter", required: false, description: "JSON фильтр" })
  @ApiResponse({ status: 200, description: "Список записей" })
  async findRecords(
    @ApiKeyContext() apiKeyContext: ApiKeyContextType,
    @Param("collection") collection: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query("search") search?: string,
    @Query("filter") filter?: string,
    @Headers("x-telegram-init-data") telegramInitData?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userContext = this.extractUserContext(telegramInitData, authorization);
    const params: PublicFindParams = {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      sortBy,
      sortOrder,
      search,
      filter: filter ? JSON.parse(filter) : undefined,
    };

    return this.publicCustomDataService.findRecords(
      apiKeyContext,
      collection,
      userContext,
      params,
    );
  }

  @Get(":collection/:key")
  @ApiOperation({ summary: "Получить запись по ключу" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiParam({ name: "key", description: "Ключ записи" })
  @ApiResponse({ status: 200, description: "Запись" })
  @ApiResponse({ status: 404, description: "Запись не найдена" })
  async getRecord(
    @ApiKeyContext() apiKeyContext: ApiKeyContextType,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Headers("x-telegram-init-data") telegramInitData?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userContext = this.extractUserContext(telegramInitData, authorization);
    return this.publicCustomDataService.getRecord(
      apiKeyContext,
      collection,
      key,
      userContext,
    );
  }

  @Post(":collection")
  @ApiOperation({ summary: "Создать запись" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 201, description: "Запись создана" })
  @ApiResponse({ status: 403, description: "Создание запрещено" })
  async createRecord(
    @ApiKeyContext() apiKeyContext: ApiKeyContextType,
    @Param("collection") collection: string,
    @Body() dto: PublicCreateDto,
    @Headers("x-telegram-init-data") telegramInitData?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userContext = this.extractUserContext(telegramInitData, authorization);
    return this.publicCustomDataService.createRecord(
      apiKeyContext,
      collection,
      dto,
      userContext,
    );
  }

  @Put(":collection/:key")
  @ApiOperation({ summary: "Обновить запись" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiParam({ name: "key", description: "Ключ записи" })
  @ApiResponse({ status: 200, description: "Запись обновлена" })
  @ApiResponse({ status: 403, description: "Обновление запрещено" })
  @ApiResponse({ status: 404, description: "Запись не найдена" })
  async updateRecord(
    @ApiKeyContext() apiKeyContext: ApiKeyContextType,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Body() dto: PublicUpdateDto,
    @Headers("x-telegram-init-data") telegramInitData?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userContext = this.extractUserContext(telegramInitData, authorization);
    return this.publicCustomDataService.updateRecord(
      apiKeyContext,
      collection,
      key,
      dto,
      userContext,
    );
  }

  @Delete(":collection/:key")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить запись" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiParam({ name: "key", description: "Ключ записи" })
  @ApiResponse({ status: 204, description: "Запись удалена" })
  @ApiResponse({ status: 403, description: "Удаление запрещено" })
  @ApiResponse({ status: 404, description: "Запись не найдена" })
  async deleteRecord(
    @ApiKeyContext() apiKeyContext: ApiKeyContextType,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Headers("x-telegram-init-data") telegramInitData?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userContext = this.extractUserContext(telegramInitData, authorization);
    await this.publicCustomDataService.deleteRecord(
      apiKeyContext,
      collection,
      key,
      userContext,
    );
  }
}
