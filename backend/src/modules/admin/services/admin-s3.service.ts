import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { S3Service } from "../../../common/s3.service";
import { Shop } from "../../../database/entities/shop.entity";
import { CustomPage } from "../../../database/entities/custom-page.entity";
import { Product } from "../../../database/entities/product.entity";
import { Category } from "../../../database/entities/category.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
import { Specialist } from "../../../database/entities/specialist.entity";
import { Service } from "../../../database/entities/service.entity";

export interface FileInfo {
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  folder: string;
  entityType?: "shop" | "customPage" | "product" | "category" | "booking" | "message" | "specialist" | "service";
  entityId?: string;
  isFolder?: boolean; // Флаг для папок
}

export interface FileEntityInfo {
  entityType: string;
  entityId: string;
  entity: any;
}

type EntityType = "shop" | "customPage" | "product" | "category" | "booking" | "message" | "specialist" | "service";

type FolderEntityInfo = {
  entityType: EntityType;
  entityId: string;
};

export interface S3Stats {
  folders: string[];
}

export interface FolderItem {
  name: string;
  path: string;
  isFolder: boolean;
  size?: number;
  lastModified?: Date;
}

@Injectable()
export class AdminS3Service {
  private readonly logger = new Logger(AdminS3Service.name);

  constructor(
    private readonly s3Service: S3Service,
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @InjectRepository(CustomPage)
    private customPageRepository: Repository<CustomPage>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>
  ) {}

  /**
   * Получает список папок верхнего уровня
   */
  async getFolders(): Promise<string[]> {
    try {
      return await this.s3Service.getTopLevelFolders();
    } catch (error) {
      this.logger.error(`Error getting folders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает подпапки для указанной папки с ограничением
   * Оптимизированная версия для дерева - загружает только первые N папок
   */
  async getSubfolders(params: {
    prefix: string;
    limit?: number;
    search?: string;
  }): Promise<{
    folders: string[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const limit = params.limit || 200; // По умолчанию 200 папок
      const prefix = params.prefix ? `${params.prefix}/` : undefined;
      const search = params.search;

      // Получаем папки с ограничением
      const result = await this.s3Service.listFiles(
        prefix,
        limit + 1, // Берем на 1 больше, чтобы определить, есть ли еще
        undefined,
        true // Включаем папки
      );

      let folders = result.folders || [];

      // Фильтруем по поисковому запросу
      if (search) {
        folders = folders.filter((folder) =>
          folder.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Определяем, есть ли еще папки
      const hasMore = result.isTruncated || folders.length > limit;
      const limitedFolders = folders.slice(0, limit);

      return {
        folders: limitedFolders,
        total: folders.length, // Примерное количество (может быть больше)
        hasMore,
      };
    } catch (error) {
      this.logger.error(`Error getting subfolders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает содержимое папки (файлы и подпапки) с пагинацией
   * Оптимизированная версия - загружает только текущую папку
   */
  async getFiles(params: {
    page?: number;
    limit?: number;
    prefix?: string;
    search?: string;
    loadEntities?: boolean; // Ленивая загрузка entity
  }): Promise<{
    items: FileInfo[];
    folders: string[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 50;
      const prefix = params.prefix ? `${params.prefix}/` : undefined;
      const search = params.search;
      const loadEntities = params.loadEntities !== false; // По умолчанию true для обратной совместимости

      // Получаем файлы только из текущей папки с пагинацией на стороне S3
      const result = await this.s3Service.listFiles(
        prefix,
        limit * 2, // Берем немного больше для фильтрации
        undefined,
        true // Включаем папки
      );

      let files = result.files;
      const folders = result.folders;

      // Преобразуем папки в FileInfo для отображения в таблице
      const foldersAsFiles: FileInfo[] = folders.map((folderName) => {
        // Формируем полный путь папки
        const folderPath = prefix ? `${prefix}${folderName}` : folderName;
        return {
          key: folderPath,
          url: "", // Папки не имеют URL
          size: 0,
          lastModified: new Date(), // Используем текущую дату для папок
          contentType: "folder",
          folder: prefix ? prefix.split("/")[0] : folderName,
          isFolder: true,
        };
      });

      // Объединяем файлы и папки
      let allItems: FileInfo[] = [...foldersAsFiles, ...files];

      // Фильтруем по поисковому запросу
      if (search) {
        allItems = allItems.filter((item) =>
          item.key.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Определяем связанные сущности только если нужно (только для файлов)
      let itemsWithEntities: FileInfo[];
      if (loadEntities) {
        // Загружаем entity только для файлов текущей страницы
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const pageItems = allItems.slice(startIndex, endIndex);

        itemsWithEntities = await Promise.all(
          pageItems.map(async (item) => {
            if (item.isFolder) {
              // Для папок тоже определяем связь
              const folderEntity = await this.getFolderEntity(item.key);
              if (folderEntity) {
                return {
                  ...item,
                  entityType: folderEntity.entityType,
                  entityId: folderEntity.entityId,
                };
              }
              return item;
            }
            return this.enrichFileWithEntity(item);
          })
        );
      } else {
        // Без entity - просто преобразуем формат
        itemsWithEntities = allItems.map((item) => ({
          key: item.key,
          url: item.url,
          size: item.size,
          lastModified: item.lastModified,
          contentType: item.contentType,
          folder: item.folder,
          isFolder: item.isFolder,
        }));
      }

      // Сортируем: сначала папки, потом файлы, внутри каждой группы по дате (новые первыми)
      itemsWithEntities.sort((a, b) => {
        // Папки всегда идут первыми
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        // Внутри группы сортируем по дате
        return b.lastModified.getTime() - a.lastModified.getTime();
      });

      // Пагинация
      // Учитываем и файлы, и папки в total
      const total = allItems.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const items = itemsWithEntities.slice(startIndex, endIndex);

      return {
        items,
        folders,
        total,
        page,
        limit,
        totalPages,
        hasMore: result.isTruncated,
      };
    } catch (error) {
      this.logger.error(`Error getting files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает статистику хранилища
   */
  async getStats(): Promise<S3Stats> {
    try {
      return await this.s3Service.getStorageStats();
    } catch (error) {
      this.logger.error(`Error getting stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Определяет связанную сущность по файлу или папке
   */
  async getFileEntity(fileUrlOrPath: string): Promise<FileEntityInfo | null> {
    try {
      // Определяем, является ли входная строка URL или путем
      const isUrl = fileUrlOrPath.startsWith("http://") || fileUrlOrPath.startsWith("https://");
      
      // Если это путь папки (не URL и не содержит расширение файла или заканчивается на /), проверяем как папку
      const isFolder = !isUrl && ((!fileUrlOrPath.match(/\.\w+$/) && !fileUrlOrPath.includes(".")) || fileUrlOrPath.endsWith("/"));
      
      if (isFolder) {
        // Это папка - определяем связь по пути
        const folderEntity = await this.getFolderEntity(fileUrlOrPath);
        if (folderEntity) {
          // Получаем полную информацию о сущности
          const entity = await this.getEntityById(
            folderEntity.entityType,
            folderEntity.entityId
          );
          
          if (entity) {
            return {
              entityType: folderEntity.entityType,
              entityId: folderEntity.entityId,
              entity,
            };
          }
        }
        return null;
      }
      
      // Это файл - получаем метаданные и определяем связь
      // getFileMetadata может обработать как URL, так и ключ S3
      // Если это URL, передаем его напрямую в getFileMetadata
      // Если это ключ, нужно получить URL через getFileUrl
      let fileUrlForMetadata = fileUrlOrPath;
      if (!isUrl) {
        // Если это ключ, получаем URL
        fileUrlForMetadata = this.s3Service.getFileUrl(fileUrlOrPath);
      }
      
      const fileMetadata = await this.s3Service.getFileMetadata(fileUrlForMetadata);
      const fileInfo: FileInfo = {
        key: fileMetadata.key,
        url: fileMetadata.url,
        size: fileMetadata.size,
        lastModified: fileMetadata.lastModified,
        contentType: fileMetadata.contentType,
        folder: fileMetadata.folder,
      };

      const enriched = await this.enrichFileWithEntity(fileInfo);

      if (!enriched.entityType || !enriched.entityId) {
        return null;
      }

      // Получаем полную информацию о сущности
      const entity = await this.getEntityById(
        enriched.entityType,
        enriched.entityId
      );

      if (!entity) {
        return null;
      }

      return {
        entityType: enriched.entityType,
        entityId: enriched.entityId,
        entity,
      };
    } catch (error) {
      this.logger.error(`Error getting file entity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Удаляет файл или папку из S3
   */
  async deleteFileOrFolder(fileKeyOrUrl: string): Promise<{ deleted: boolean; message: string }> {
    try {
      // Определяем, является ли это URL или ключом
      const isUrl = fileKeyOrUrl.startsWith("http://") || fileKeyOrUrl.startsWith("https://");
      let fileKey = fileKeyOrUrl;
      
      if (isUrl) {
        // Извлекаем ключ из URL
        try {
          const url = new URL(fileKeyOrUrl);
          fileKey = url.pathname.substring(1);
        } catch (error) {
          this.logger.warn(`Failed to parse URL, using as key: ${fileKeyOrUrl}`);
        }
      }
      
      // Проверяем, является ли это папкой (заканчивается на / или не имеет расширения)
      const isFolder = fileKey.endsWith("/") || (!fileKey.match(/\.\w+$/) && !isUrl);
      
      if (isFolder) {
        // Удаляем все файлы в папке
        const prefix = fileKey.endsWith("/") ? fileKey : `${fileKey}/`;
        let deletedCount = 0;
        let continuationToken: string | undefined;
        
        do {
          const result = await this.s3Service.listFiles(prefix, 1000, continuationToken, false);
          
          // Удаляем все файлы
          if (result.files.length > 0) {
            const fileUrls = result.files.map((f) => f.url);
            await this.s3Service.deleteMultipleFiles(fileUrls);
            deletedCount += result.files.length;
          }
          
          continuationToken = result.isTruncated ? result.nextContinuationToken : undefined;
        } while (continuationToken);
        
        this.logger.log(`Deleted folder ${fileKey} with ${deletedCount} files`);
        return {
          deleted: true,
          message: `Папка удалена. Удалено файлов: ${deletedCount}`,
        };
      } else {
        // Удаляем один файл
        if (isUrl) {
          await this.s3Service.deleteFile(fileKeyOrUrl);
        } else {
          // Если это ключ, нужно получить URL через getFileUrl
          // Используем публичный метод getFileUrl из S3Service
          const fileUrl = this.s3Service.getFileUrl(fileKey);
          await this.s3Service.deleteFile(fileUrl);
        }
        
        this.logger.log(`Deleted file ${fileKey}`);
        return {
          deleted: true,
          message: "Файл удален",
        };
      }
    } catch (error) {
      this.logger.error(`Error deleting file or folder: ${error.message}`);
      throw new Error(`Ошибка удаления: ${error.message}`);
    }
  }

  /**
   * Получает файлы, связанные с сущностью
   */
  async getEntityFiles(
    entityType: string,
    entityId: string
  ): Promise<FileInfo[]> {
    try {
      const entity = await this.getEntityById(entityType, entityId);

      if (!entity) {
        return [];
      }

      const files: FileInfo[] = [];

      switch (entityType) {
        case "shop":
          if (entity.logoUrl) {
            try {
              const metadata = await this.s3Service.getFileMetadata(
                entity.logoUrl
              );
              files.push({
                key: metadata.key,
                url: metadata.url,
                size: metadata.size,
                lastModified: metadata.lastModified,
                contentType: metadata.contentType,
                folder: metadata.folder,
                entityType: "shop",
                entityId: entity.id,
              });
            } catch (error) {
              this.logger.warn(
                `Failed to get metadata for shop logo: ${error.message}`
              );
            }
          }
          break;

        case "customPage":
          if (entity.assets && Array.isArray(entity.assets)) {
            for (const asset of entity.assets) {
              try {
                const fileUrl = this.s3Service.getFileUrl(asset.s3Key);
                const metadata = await this.s3Service.getFileMetadata(fileUrl);
                files.push({
                  key: metadata.key,
                  url: metadata.url,
                  size: metadata.size,
                  lastModified: metadata.lastModified,
                  contentType: metadata.contentType,
                  folder: metadata.folder,
                  entityType: "customPage",
                  entityId: entity.id,
                });
              } catch (error) {
                this.logger.warn(
                  `Failed to get metadata for custom page asset: ${error.message}`
                );
              }
            }
          }
          break;

        case "product":
          if (entity.images && Array.isArray(entity.images)) {
            for (const imageUrl of entity.images) {
              try {
                const metadata = await this.s3Service.getFileMetadata(imageUrl);
                files.push({
                  key: metadata.key,
                  url: metadata.url,
                  size: metadata.size,
                  lastModified: metadata.lastModified,
                  contentType: metadata.contentType,
                  folder: metadata.folder,
                  entityType: "product",
                  entityId: entity.id,
                });
              } catch (error) {
                this.logger.warn(
                  `Failed to get metadata for product image: ${error.message}`
                );
              }
            }
          }
          break;

        case "category":
          if (entity.imageUrl) {
            try {
              const metadata = await this.s3Service.getFileMetadata(
                entity.imageUrl
              );
              files.push({
                key: metadata.key,
                url: metadata.url,
                size: metadata.size,
                lastModified: metadata.lastModified,
                contentType: metadata.contentType,
                folder: metadata.folder,
                entityType: "category",
                entityId: entity.id,
              });
            } catch (error) {
              this.logger.warn(
                `Failed to get metadata for category image: ${error.message}`
              );
            }
          }
          break;

        case "booking":
          if (entity.logoUrl) {
            try {
              const metadata = await this.s3Service.getFileMetadata(
                entity.logoUrl
              );
              files.push({
                key: metadata.key,
                url: metadata.url,
                size: metadata.size,
                lastModified: metadata.lastModified,
                contentType: metadata.contentType,
                folder: metadata.folder,
                entityType: "booking",
                entityId: entity.id,
              });
            } catch (error) {
              this.logger.warn(
                `Failed to get metadata for booking logo: ${error.message}`
              );
            }
          }
          break;

        case "specialist":
          if (entity.avatarUrl) {
            try {
              const metadata = await this.s3Service.getFileMetadata(
                entity.avatarUrl
              );
              files.push({
                key: metadata.key,
                url: metadata.url,
                size: metadata.size,
                lastModified: metadata.lastModified,
                contentType: metadata.contentType,
                folder: metadata.folder,
                entityType: "specialist",
                entityId: entity.id,
              });
            } catch (error) {
              this.logger.warn(
                `Failed to get metadata for specialist avatar: ${error.message}`
              );
            }
          }
          break;

        case "service":
          if (entity.imageUrl) {
            try {
              const metadata = await this.s3Service.getFileMetadata(
                entity.imageUrl
              );
              files.push({
                key: metadata.key,
                url: metadata.url,
                size: metadata.size,
                lastModified: metadata.lastModified,
                contentType: metadata.contentType,
                folder: metadata.folder,
                entityType: "service",
                entityId: entity.id,
              });
            } catch (error) {
              this.logger.warn(
                `Failed to get metadata for service image: ${error.message}`
              );
            }
          }
          break;
      }

      return files;
    } catch (error) {
      this.logger.error(`Error getting entity files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Определяет связь папки с сущностью по пути папки
   */
  private async getFolderEntity(folderPath: string): Promise<FolderEntityInfo | null> {
    try {
      // Извлекаем название папки из пути
      const pathParts = folderPath.split("/").filter(Boolean);
      if (pathParts.length === 0) return null;

      const folderName = pathParts[0];
      const subPath = pathParts.length > 1 ? pathParts[1] : null;

      // Определяем тип сущности по названию папки
      if (folderName === "custom-pages" && subPath) {
        // custom-pages/{pageId} -> customPage
        const page = await this.customPageRepository.findOne({
          where: { id: subPath },
        });
        if (page) {
          return {
            entityType: "customPage",
            entityId: page.id,
          };
        }
      } else if (folderName === "products") {
        // Папка products не связана с конкретным продуктом
        // Файлы продуктов сохраняются как products/{uuid}.{ext} без подпапок
        // Поэтому папка products сама по себе не имеет связи с сущностью
        return null;
      } else if (folderName === "shop-logos") {
        // shop-logos -> может быть несколько магазинов, возвращаем null
        return null;
      } else if (folderName === "category-images") {
        // category-images -> может быть несколько категорий
        return null;
      } else if (folderName === "booking-logos") {
        // booking-logos -> может быть несколько систем
        return null;
      } else if (folderName === "specialist-avatars") {
        // specialist-avatars -> может быть несколько специалистов
        return null;
      } else if (folderName === "service-images") {
        // service-images -> может быть несколько услуг
        return null;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error determining folder entity: ${error.message}`);
      return null;
    }
  }

  /**
   * Обогащает информацию о файле данными о связанной сущности
   */
  private async enrichFileWithEntity(file: FileInfo): Promise<FileInfo> {
    try {
      const folder = file.folder;
      const key = file.key;

      // Определяем тип сущности по папке
      if (folder === "shop-logos") {
        const shop = await this.shopRepository.findOne({
          where: { logoUrl: file.url },
        });
        if (shop) {
          return {
            ...file,
            entityType: "shop",
            entityId: shop.id,
          };
        }
      } else if (folder === "custom-pages") {
        // Извлекаем pageId из пути: custom-pages/{pageId}/...
        const match = key.match(/^custom-pages\/([^/]+)\//);
        if (match) {
          const pageId = match[1];
          const page = await this.customPageRepository.findOne({
            where: { id: pageId },
          });
          if (page) {
            return {
              ...file,
              entityType: "customPage",
              entityId: page.id,
            };
          }
        }
      } else if (folder === "products") {
        // Файлы продуктов сохраняются как products/{uuid}.{ext}
        // Ищем продукт по URL изображения в массиве images
        const fileKey = file.key; // Например: "products/abc-123-def.webp"
        const fileName = fileKey.split("/").pop() || ""; // Имя файла без пути (например: "abc-123-def.webp")
        
        this.logger.debug(`Searching product for file: key=${fileKey}, url=${file.url}, fileName=${fileName}`);
        
        // Поле images имеет тип json, а не jsonb, поэтому нужно приводить к jsonb для операций
        // Или использовать json_array_elements для работы с json
        
        // Нормализуем URL для поиска (убираем параметры, trailing slash и т.д.)
        const normalizeUrl = (url: string) => {
          try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
          } catch {
            return url.split("?")[0].split("#")[0]; // Убираем query и fragment
          }
        };
        
        const normalizedFileUrl = normalizeUrl(file.url);
        
        // Сначала пробуем точный поиск по полному URL (приводим json к jsonb)
        let product = await this.productRepository
          .createQueryBuilder("product")
          .where("product.images::jsonb @> :url", { url: JSON.stringify([file.url]) })
          .getOne();
        
        // Если не нашли, пробуем поиск по нормализованному URL
        if (!product) {
          product = await this.productRepository
            .createQueryBuilder("product")
            .where("product.images IS NOT NULL")
            .andWhere(
              `EXISTS (
                SELECT 1 FROM json_array_elements_text(product.images::json) AS img_url 
                WHERE :normalizedUrl = regexp_replace(img_url::text, '[?#].*', '')
              )`,
              { normalizedUrl: normalizedFileUrl }
            )
            .getOne();
        }
        
        // Если не нашли, ищем по имени файла в URL (UUID уникален для каждого файла)
        if (!product && fileName) {
          product = await this.productRepository
            .createQueryBuilder("product")
            .where("product.images IS NOT NULL")
            .andWhere(
              `EXISTS (
                SELECT 1 FROM json_array_elements_text(product.images::json) AS img_url 
                WHERE img_url::text LIKE :fileName
              )`,
              { fileName: `%${fileName}%` }
            )
            .getOne();
        }
        
        // Если все еще не нашли, пробуем поиск по ключу файла (products/{uuid}.{ext})
        if (!product && fileKey) {
          product = await this.productRepository
            .createQueryBuilder("product")
            .where("product.images IS NOT NULL")
            .andWhere(
              `EXISTS (
                SELECT 1 FROM json_array_elements_text(product.images::json) AS img_url 
                WHERE img_url::text LIKE :fileKey
              )`,
              { fileKey: `%${fileKey}%` }
            )
            .getOne();
        }
        
        if (product) {
          this.logger.debug(`Found product: ${product.id} for file: ${fileKey}`);
        } else {
          this.logger.warn(`Product not found for file: key=${fileKey}, url=${file.url}, normalizedUrl=${normalizedFileUrl}`);
        }
        
        if (product) {
          return {
            ...file,
            entityType: "product",
            entityId: product.id,
          };
        }
      } else if (folder === "category-images") {
        const category = await this.categoryRepository.findOne({
          where: { imageUrl: file.url },
        });
        if (category) {
          return {
            ...file,
            entityType: "category",
            entityId: category.id,
          };
        }
      } else if (folder === "booking-logos") {
        const booking = await this.bookingSystemRepository.findOne({
          where: { logoUrl: file.url },
        });
        if (booking) {
          return {
            ...file,
            entityType: "booking",
            entityId: booking.id,
          };
        }
      } else if (folder === "specialist-avatars") {
        const specialist = await this.specialistRepository.findOne({
          where: { avatarUrl: file.url },
        });
        if (specialist) {
          return {
            ...file,
            entityType: "specialist",
            entityId: specialist.id,
          };
        }
      } else if (folder === "service-images") {
        const service = await this.serviceRepository.findOne({
          where: { imageUrl: file.url },
        });
        if (service) {
          return {
            ...file,
            entityType: "service",
            entityId: service.id,
          };
        }
      } else if (folder === "message-images") {
        // Message entity может иметь изображения, но структура может отличаться
        // Пока оставляем без entityType, можно добавить позже
      }

      return file;
    } catch (error) {
      this.logger.warn(
        `Error enriching file with entity: ${error.message}, file: ${file.key}`
      );
      return file;
    }
  }

  /**
   * Получает сущность по типу и ID
   */
  private async getEntityById(
    entityType: string,
    entityId: string
  ): Promise<any> {
    switch (entityType) {
      case "shop":
        return await this.shopRepository.findOne({
          where: { id: entityId },
          relations: ["owner"],
        });

      case "customPage":
        return await this.customPageRepository.findOne({
          where: { id: entityId },
          relations: ["owner", "shop", "bot"],
        });

      case "product":
        return await this.productRepository.findOne({
          where: { id: entityId },
          relations: ["shop", "category"],
        });

      case "category":
        return await this.categoryRepository.findOne({
          where: { id: entityId },
          relations: ["shop"],
        });

      case "booking":
        return await this.bookingSystemRepository.findOne({
          where: { id: entityId },
          relations: ["owner"],
        });

      case "specialist":
        return await this.specialistRepository.findOne({
          where: { id: entityId },
          relations: ["bookingSystem"],
        });

      case "service":
        return await this.serviceRepository.findOne({
          where: { id: entityId },
          relations: ["bookingSystem"],
        });

      default:
        return null;
    }
  }
}
