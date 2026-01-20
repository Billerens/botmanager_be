import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomDataOwnershipGuard } from "./guards/custom-data-ownership.guard";
import { CustomDataOwnerType } from "../../database/entities/custom-collection-schema.entity";
import {
  PublicApiKeyService,
  CreateApiKeyDto,
  UpdateApiKeyDto,
} from "./public-api-key.service";

/**
 * Контроллер для управления API ключами (для владельцев)
 */
@ApiTags("API Keys Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CustomDataOwnershipGuard)
@Controller("api/custom-data/:ownerType/:ownerId/api-keys")
export class ApiKeysController {
  constructor(private readonly publicApiKeyService: PublicApiKeyService) {}

  @Post()
  @ApiOperation({ summary: "Создать новый API ключ" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiResponse({ status: 201, description: "API ключ создан" })
  async createApiKey(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.publicApiKeyService.createApiKey(ownerId, ownerType, dto);
  }

  @Get()
  @ApiOperation({ summary: "Получить список API ключей" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiResponse({ status: 200, description: "Список API ключей" })
  async getApiKeys(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
  ) {
    const keys = await this.publicApiKeyService.getApiKeys(ownerId, ownerType);
    // Маскируем ключи для безопасности (показываем только первые и последние символы)
    return keys.map((key) => ({
      ...key,
      key: this.maskKey(key.key),
    }));
  }

  @Get(":keyId")
  @ApiOperation({ summary: "Получить API ключ по ID" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "keyId", description: "ID API ключа" })
  @ApiResponse({ status: 200, description: "API ключ" })
  @ApiResponse({ status: 404, description: "API ключ не найден" })
  async getApiKey(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("keyId") keyId: string,
  ) {
    const key = await this.publicApiKeyService.getApiKeyById(
      keyId,
      ownerId,
      ownerType,
    );
    return {
      ...key,
      key: this.maskKey(key.key),
    };
  }

  @Put(":keyId")
  @ApiOperation({ summary: "Обновить API ключ" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "keyId", description: "ID API ключа" })
  @ApiResponse({ status: 200, description: "API ключ обновлён" })
  @ApiResponse({ status: 404, description: "API ключ не найден" })
  async updateApiKey(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("keyId") keyId: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    const key = await this.publicApiKeyService.updateApiKey(
      keyId,
      ownerId,
      ownerType,
      dto,
    );
    return {
      ...key,
      key: this.maskKey(key.key),
    };
  }

  @Post(":keyId/regenerate")
  @ApiOperation({ summary: "Перегенерировать API ключ" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "keyId", description: "ID API ключа" })
  @ApiResponse({ status: 200, description: "Новый API ключ (показывается только один раз)" })
  @ApiResponse({ status: 404, description: "API ключ не найден" })
  async regenerateApiKey(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("keyId") keyId: string,
  ) {
    // При регенерации возвращаем полный ключ (только один раз)
    return this.publicApiKeyService.regenerateApiKey(keyId, ownerId, ownerType);
  }

  @Delete(":keyId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить API ключ" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "keyId", description: "ID API ключа" })
  @ApiResponse({ status: 204, description: "API ключ удалён" })
  @ApiResponse({ status: 404, description: "API ключ не найден" })
  async deleteApiKey(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("keyId") keyId: string,
  ) {
    await this.publicApiKeyService.deleteApiKey(keyId, ownerId, ownerType);
  }

  /**
   * Маскировать API ключ для отображения
   * pk_live_abc123...xyz789 → pk_live_abc1***xyz7
   */
  private maskKey(key: string): string {
    if (key.length < 20) return "***";
    const prefix = key.slice(0, 12); // pk_live_abc1
    const suffix = key.slice(-4); // xyz7
    return `${prefix}***${suffix}`;
  }
}
