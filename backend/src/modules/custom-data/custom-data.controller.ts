import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CustomDataService } from "./custom-data.service";
import { CustomDataOwnerType } from "../../database/entities/custom-collection-schema.entity";
import { CustomDataOwnershipGuard } from "./guards/custom-data-ownership.guard";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  CollectionParamsDto,
  CollectionNameParamsDto,
  CreateDataDto,
  CreateBulkDataDto,
  UpdateDataDto,
  PatchDataDto,
  FindDataQueryDto,
  AdvancedQueryDto,
  AggregateQueryDto,
  DataParamsDto,
  DataKeyParamsDto,
  ImportDataDto,
  ExportDataDto,
} from "./dto";

@ApiTags("Custom Data")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CustomDataOwnershipGuard)
@Controller("api/custom-data")
export class CustomDataController {
  constructor(private readonly customDataService: CustomDataService) {}

  // ========================================================================
  // КОЛЛЕКЦИИ (СХЕМЫ)
  // ========================================================================

  @Post(":ownerType/:ownerId/collections")
  @ApiOperation({ summary: "Создать новую коллекцию" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца (бот, магазин и т.д.)" })
  @ApiResponse({ status: 201, description: "Коллекция создана" })
  @ApiResponse({ status: 409, description: "Коллекция уже существует" })
  async createCollection(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.customDataService.createCollection(ownerId, ownerType, dto);
  }

  @Get(":ownerType/:ownerId/collections")
  @ApiOperation({ summary: "Получить список коллекций" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiResponse({ status: 200, description: "Список коллекций" })
  async getCollections(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
  ) {
    return this.customDataService.getCollections(ownerId, ownerType);
  }

  @Get(":ownerType/:ownerId/collections/:collectionName")
  @ApiOperation({ summary: "Получить информацию о коллекции" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collectionName", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Информация о коллекции" })
  @ApiResponse({ status: 404, description: "Коллекция не найдена" })
  async getCollection(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collectionName") collectionName: string,
  ) {
    return this.customDataService.getCollection(ownerId, ownerType, collectionName);
  }

  @Get(":ownerType/:ownerId/collections/:collectionName/stats")
  @ApiOperation({ summary: "Получить статистику коллекции" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collectionName", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Статистика коллекции" })
  async getCollectionStats(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collectionName") collectionName: string,
  ) {
    return this.customDataService.getCollectionStats(ownerId, ownerType, collectionName);
  }

  @Put(":ownerType/:ownerId/collections/:collectionName")
  @ApiOperation({ summary: "Обновить коллекцию" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collectionName", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Коллекция обновлена" })
  @ApiResponse({ status: 404, description: "Коллекция не найдена" })
  async updateCollection(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collectionName") collectionName: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.customDataService.updateCollection(ownerId, ownerType, collectionName, dto);
  }

  @Delete(":ownerType/:ownerId/collections/:collectionName")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить коллекцию" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collectionName", description: "Имя коллекции" })
  @ApiResponse({ status: 204, description: "Коллекция удалена" })
  @ApiResponse({ status: 404, description: "Коллекция не найдена" })
  async deleteCollection(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collectionName") collectionName: string,
    @Query("hard") hard?: string,
  ) {
    await this.customDataService.deleteCollection(
      ownerId,
      ownerType,
      collectionName,
      hard === "true",
    );
  }

  // ========================================================================
  // ДАННЫЕ
  // ========================================================================

  @Post(":ownerType/:ownerId/data/:collection")
  @ApiOperation({ summary: "Создать запись" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 201, description: "Запись создана" })
  @ApiResponse({ status: 409, description: "Запись с таким ключом уже существует" })
  async createRecord(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Body() dto: CreateDataDto,
    @CurrentUser() user: any,
  ) {
    return this.customDataService.createRecord(
      ownerId,
      ownerType,
      collection,
      dto,
      user?.id,
    );
  }

  @Post(":ownerType/:ownerId/data/:collection/bulk")
  @ApiOperation({ summary: "Пакетное создание записей" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 201, description: "Записи созданы" })
  async createBulkRecords(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Body() dto: CreateBulkDataDto,
    @CurrentUser() user: any,
  ) {
    return this.customDataService.createBulkRecords(
      ownerId,
      ownerType,
      collection,
      dto.records,
      user?.id,
    );
  }

  @Get(":ownerType/:ownerId/data/:collection")
  @ApiOperation({ summary: "Получить список записей" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Список записей" })
  async findRecords(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Query() query: FindDataQueryDto,
  ) {
    return this.customDataService.findRecords(ownerId, ownerType, collection, query);
  }

  @Post(":ownerType/:ownerId/data/:collection/query")
  @ApiOperation({ summary: "Продвинутый запрос данных" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Результаты запроса" })
  async advancedQuery(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Body() query: AdvancedQueryDto,
  ) {
    return this.customDataService.advancedQuery(ownerId, ownerType, collection, query);
  }

  @Post(":ownerType/:ownerId/data/:collection/aggregate")
  @ApiOperation({ summary: "Агрегация данных" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Результат агрегации" })
  async aggregate(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Body() query: AggregateQueryDto,
  ) {
    return this.customDataService.aggregate(ownerId, ownerType, collection, query);
  }

  @Post(":ownerType/:ownerId/data/:collection/import")
  @ApiOperation({ summary: "Импорт данных" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Результат импорта" })
  async importData(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Body() dto: ImportDataDto,
    @CurrentUser() user: any,
  ) {
    return this.customDataService.importData(
      ownerId,
      ownerType,
      collection,
      dto,
      user?.id,
    );
  }

  @Get(":ownerType/:ownerId/data/:collection/:key")
  @ApiOperation({ summary: "Получить запись по ключу" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiParam({ name: "key", description: "Ключ записи" })
  @ApiResponse({ status: 200, description: "Запись" })
  @ApiResponse({ status: 404, description: "Запись не найдена" })
  async getRecord(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Param("key") key: string,
  ) {
    return this.customDataService.getRecord(ownerId, ownerType, collection, key);
  }

  @Put(":ownerType/:ownerId/data/:collection/:key")
  @ApiOperation({ summary: "Обновить запись" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiParam({ name: "key", description: "Ключ записи" })
  @ApiResponse({ status: 200, description: "Запись обновлена" })
  @ApiResponse({ status: 404, description: "Запись не найдена" })
  async updateRecord(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Body() dto: UpdateDataDto,
    @CurrentUser() user: any,
  ) {
    return this.customDataService.updateRecord(
      ownerId,
      ownerType,
      collection,
      key,
      dto,
      user?.id,
    );
  }

  @Patch(":ownerType/:ownerId/data/:collection/:key")
  @ApiOperation({ summary: "Частичное обновление записи" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiParam({ name: "key", description: "Ключ записи" })
  @ApiResponse({ status: 200, description: "Запись обновлена" })
  @ApiResponse({ status: 404, description: "Запись не найдена" })
  async patchRecord(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Body() dto: PatchDataDto,
    @CurrentUser() user: any,
  ) {
    return this.customDataService.patchRecord(
      ownerId,
      ownerType,
      collection,
      key,
      dto,
      user?.id,
    );
  }

  @Delete(":ownerType/:ownerId/data/:collection/:key")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить запись" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiParam({ name: "key", description: "Ключ записи" })
  @ApiResponse({ status: 204, description: "Запись удалена" })
  @ApiResponse({ status: 404, description: "Запись не найдена" })
  async deleteRecord(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Query("hard") hard?: string,
  ) {
    await this.customDataService.deleteRecord(
      ownerId,
      ownerType,
      collection,
      key,
      hard === "true",
    );
  }

  @Delete(":ownerType/:ownerId/data/:collection")
  @ApiOperation({ summary: "Пакетное удаление записей" })
  @ApiParam({ name: "ownerType", enum: CustomDataOwnerType })
  @ApiParam({ name: "ownerId", description: "ID владельца" })
  @ApiParam({ name: "collection", description: "Имя коллекции" })
  @ApiResponse({ status: 200, description: "Записи удалены" })
  async deleteBulkRecords(
    @Param("ownerType") ownerType: CustomDataOwnerType,
    @Param("ownerId") ownerId: string,
    @Param("collection") collection: string,
    @Body() body: { keys: string[] },
    @Query("hard") hard?: string,
  ) {
    return this.customDataService.deleteBulkRecords(
      ownerId,
      ownerType,
      collection,
      body.keys,
      hard === "true",
    );
  }
}
