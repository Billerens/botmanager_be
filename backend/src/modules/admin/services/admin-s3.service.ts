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
}

export interface FileEntityInfo {
  entityType: string;
  entityId: string;
  entity: any;
}

export interface S3Stats {
  totalFiles: number;
  totalSize: number;
  byFolder: Record<
    string,
    {
      count: number;
      size: number;
    }
  >;
  byType: Record<
    string,
    {
      count: number;
      size: number;
    }
  >;
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
   * Получает список файлов с пагинацией и фильтрами
   */
  async getFiles(params: {
    page?: number;
    limit?: number;
    prefix?: string;
    search?: string;
  }): Promise<{
    items: FileInfo[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 50;
      const prefix = params.prefix;
      const search = params.search;

      // Получаем файлы из S3
      let allFiles: FileInfo[] = [];
      let continuationToken: string | undefined;
      let hasMore = true;
      const maxFilesToFetch = 10000; // Ограничение для безопасности

      while (hasMore && allFiles.length < maxFilesToFetch) {
        const result = await this.s3Service.listFiles(
          prefix,
          1000,
          continuationToken
        );

        allFiles = allFiles.concat(result.files);

        hasMore = result.isTruncated;
        continuationToken = result.nextContinuationToken;

        // Если указан префикс, не нужно получать все файлы
        if (prefix) {
          break;
        }
      }

      // Фильтруем по поисковому запросу
      if (search) {
        allFiles = allFiles.filter((file) =>
          file.key.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Определяем связанные сущности для каждого файла
      const filesWithEntities = await Promise.all(
        allFiles.map((file) => this.enrichFileWithEntity(file))
      );

      // Сортируем по дате изменения (новые первыми)
      filesWithEntities.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
      );

      // Пагинация
      const total = filesWithEntities.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const items = filesWithEntities.slice(startIndex, endIndex);

      return {
        items,
        total,
        page,
        limit,
        totalPages,
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
   * Определяет связанную сущность по файлу
   */
  async getFileEntity(fileUrl: string): Promise<FileEntityInfo | null> {
    try {
      const fileMetadata = await this.s3Service.getFileMetadata(fileUrl);
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
        // Ищем продукт по URL изображения в массиве images
        const product = await this.productRepository
          .createQueryBuilder("product")
          .where("product.images @> :url", { url: JSON.stringify([file.url]) })
          .getOne();
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
