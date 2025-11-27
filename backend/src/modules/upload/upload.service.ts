import { Injectable, Logger } from "@nestjs/common";
import { S3Service } from "../../common/s3.service";
import { ImageConversionService } from "../../common/image-conversion.service";
import * as JSZip from "jszip";
import * as mime from "mime-types";
import { CustomPageAsset } from "../../database/entities/custom-page.entity";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly imageConversionService: ImageConversionService
  ) {}

  /**
   * Конвертирует файл изображения в WebP формат
   * @param file Файл изображения
   * @param options Опции конвертации (опционально)
   */
  private async convertImageToWebP(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
    options?: {
      quality?: number;
      maxWidth?: number;
      maxHeight?: number;
      effort?: number;
      smartSubsample?: boolean;
      nearLossless?: boolean;
    }
  ): Promise<{ buffer: Buffer; originalname: string; mimetype: string }> {
    try {
      // Проверяем, является ли файл изображением
      const isImage = await this.imageConversionService.isImage(file.buffer);

      if (!isImage) {
        // Если не изображение, возвращаем оригинал
        return file;
      }

      // Конвертируем в WebP
      // Используем настройки по умолчанию (effort: 5, smartSubsample: true)
      // которые обеспечивают оптимальный баланс качества и размера файла
      const webpBuffer = await this.imageConversionService.convertToWebP(
        file.buffer,
        options || {
          quality: 70,
          maxWidth: 1920,
          maxHeight: 1920,
        }
      );

      // Обновляем имя файла и MIME тип
      const originalNameWithoutExt = file.originalname.replace(/\.[^/.]+$/, "");
      const newOriginalName = `${originalNameWithoutExt}.webp`;

      return {
        buffer: webpBuffer,
        originalname: newOriginalName,
        mimetype: "image/webp",
      };
    } catch (error) {
      this.logger.warn(
        `Failed to convert image to WebP, using original: ${error.message}`
      );
      // В случае ошибки конвертации возвращаем оригинальный файл
      return file;
    }
  }

  /**
   * Загружает изображения продукта в S3 с конвертацией в WebP
   */
  async uploadProductImages(
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>
  ): Promise<string[]> {
    try {
      this.logger.log(`Uploading ${files.length} product images`);

      // Конвертируем все изображения в WebP
      const convertedFiles = await Promise.all(
        files.map((file) => this.convertImageToWebP(file))
      );

      const imageUrls = await this.s3Service.uploadMultipleFiles(
        convertedFiles,
        "products"
      );

      this.logger.log(`Successfully uploaded ${imageUrls.length} images`);
      return imageUrls;
    } catch (error) {
      this.logger.error(`Error uploading product images: ${error.message}`);
      throw error;
    }
  }

  /**
   * Удаляет изображения продукта из S3
   */
  async deleteProductImages(imageUrls: string[]): Promise<void> {
    try {
      this.logger.log(`Deleting ${imageUrls.length} product images`);

      await this.s3Service.deleteMultipleFiles(imageUrls);

      this.logger.log(`Successfully deleted ${imageUrls.length} images`);
    } catch (error) {
      this.logger.error(`Error deleting product images: ${error.message}`);
      throw error;
    }
  }

  /**
   * Обновляет изображения продукта (удаляет старые, загружает новые)
   */
  async updateProductImages(
    oldImageUrls: string[],
    newFiles: Array<{ buffer: Buffer; originalname: string; mimetype: string }>
  ): Promise<string[]> {
    try {
      // Удаляем старые изображения
      if (oldImageUrls.length > 0) {
        await this.deleteProductImages(oldImageUrls);
      }

      // Загружаем новые изображения
      if (newFiles.length > 0) {
        return await this.uploadProductImages(newFiles);
      }

      return [];
    } catch (error) {
      this.logger.error(`Error updating product images: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загружает логотип магазина в S3 с конвертацией в WebP
   */
  async uploadShopLogo(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading shop logo: ${file.originalname}`);

      // Конвертируем в WebP с более высоким качеством для логотипов
      const convertedFile = await this.convertImageToWebP(file, {
        quality: 80, // Более высокое качество для логотипов
        maxWidth: 1920,
        maxHeight: 1920,
      });

      const imageUrl = await this.s3Service.uploadFile(
        convertedFile.buffer,
        convertedFile.originalname,
        convertedFile.mimetype,
        "shop-logos"
      );

      this.logger.log(`Successfully uploaded shop logo: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      this.logger.error(`Error uploading shop logo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загружает логотип системы бронирования в S3 с конвертацией в WebP
   */
  async uploadBookingLogo(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading booking logo: ${file.originalname}`);

      // Конвертируем в WebP с более высоким качеством для логотипов
      const convertedFile = await this.convertImageToWebP(file, {
        quality: 80, // Более высокое качество для логотипов
        maxWidth: 1920,
        maxHeight: 1920,
      });

      const imageUrl = await this.s3Service.uploadFile(
        convertedFile.buffer,
        convertedFile.originalname,
        convertedFile.mimetype,
        "booking-logos"
      );

      this.logger.log(`Successfully uploaded booking logo: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      this.logger.error(`Error uploading booking logo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загружает аватар специалиста в S3 с конвертацией в WebP
   */
  async uploadSpecialistAvatar(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading specialist avatar: ${file.originalname}`);

      // Конвертируем в WebP
      const convertedFile = await this.convertImageToWebP(file);

      const imageUrl = await this.s3Service.uploadFile(
        convertedFile.buffer,
        convertedFile.originalname,
        convertedFile.mimetype,
        "specialist-avatars"
      );

      this.logger.log(`Successfully uploaded specialist avatar: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      this.logger.error(`Error uploading specialist avatar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загружает изображение услуги в S3 с конвертацией в WebP
   */
  async uploadServiceImage(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading service image: ${file.originalname}`);

      // Конвертируем в WebP
      const convertedFile = await this.convertImageToWebP(file);

      const imageUrl = await this.s3Service.uploadFile(
        convertedFile.buffer,
        convertedFile.originalname,
        convertedFile.mimetype,
        "service-images"
      );

      this.logger.log(`Successfully uploaded service image: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      this.logger.error(`Error uploading service image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загружает изображение сообщения/рассылки в S3 с конвертацией в WebP
   */
  async uploadMessageImage(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading message image: ${file.originalname}`);

      // Конвертируем в WebP
      const convertedFile = await this.convertImageToWebP(file);

      const imageUrl = await this.s3Service.uploadFile(
        convertedFile.buffer,
        convertedFile.originalname,
        convertedFile.mimetype,
        "message-images"
      );

      this.logger.log(`Successfully uploaded message image: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      this.logger.error(`Error uploading message image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загружает изображение категории в S3 с конвертацией в WebP
   */
  async uploadCategoryImage(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading category image: ${file.originalname}`);

      // Конвертируем в WebP
      const convertedFile = await this.convertImageToWebP(file);

      const imageUrl = await this.s3Service.uploadFile(
        convertedFile.buffer,
        convertedFile.originalname,
        convertedFile.mimetype,
        "category-images"
      );

      this.logger.log(`Successfully uploaded category image: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      this.logger.error(`Error uploading category image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Удаляет изображение категории из S3
   */
  async deleteCategoryImage(imageUrl: string): Promise<void> {
    try {
      this.logger.log(`Deleting category image: ${imageUrl}`);

      await this.s3Service.deleteFile(imageUrl);

      this.logger.log(`Successfully deleted category image`);
    } catch (error) {
      this.logger.error(`Error deleting category image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Загружает ZIP-архив с бандлом статической страницы в S3
   * @param pageId ID страницы для формирования пути
   * @param zipBuffer Buffer с ZIP-архивом
   * @returns Информация о загруженных файлах
   */
  async uploadCustomPageBundle(
    pageId: string,
    zipBuffer: Buffer
  ): Promise<{
    staticPath: string;
    assets: CustomPageAsset[];
    entryPoint: string;
  }> {
    try {
      this.logger.log(`Uploading custom page bundle for page ${pageId}`);

      const zip = await JSZip.loadAsync(zipBuffer);
      const assets: CustomPageAsset[] = [];
      const staticPath = `custom-pages/${pageId}`;

      // Находим корневую директорию в архиве (если есть)
      const entries = Object.entries(zip.files);
      let rootPrefix = "";

      // Проверяем, есть ли общая корневая папка (например, "dist/" или "build/")
      const firstEntry = entries.find(([_, file]) => !file.dir);
      if (firstEntry) {
        const pathParts = firstEntry[0].split("/");
        if (
          pathParts.length > 1 &&
          entries.every(([path]) => path.startsWith(pathParts[0] + "/"))
        ) {
          rootPrefix = pathParts[0] + "/";
        }
      }

      // Загружаем все файлы
      const uploadPromises: Promise<void>[] = [];

      for (const [path, zipEntry] of entries) {
        if (zipEntry.dir) continue;

        // Убираем корневой префикс из пути
        let relativePath = path;
        if (rootPrefix && path.startsWith(rootPrefix)) {
          relativePath = path.substring(rootPrefix.length);
        }

        // Пропускаем скрытые файлы и системные файлы
        if (
          relativePath.startsWith(".") ||
          relativePath.includes("/.") ||
          relativePath === "Thumbs.db" ||
          relativePath === ".DS_Store"
        ) {
          continue;
        }

        const uploadPromise = (async () => {
          const content = await zipEntry.async("nodebuffer");
          const mimeType =
            mime.lookup(relativePath) || "application/octet-stream";
          const s3Key = `${staticPath}/${relativePath}`;

          await this.s3Service.uploadFile(
            content,
            relativePath,
            mimeType,
            staticPath
          );

          assets.push({
            fileName: relativePath,
            s3Key,
            size: content.length,
            mimeType,
          });
        })();

        uploadPromises.push(uploadPromise);
      }

      await Promise.all(uploadPromises);

      // Определяем точку входа
      let entryPoint = "index.html";
      const hasIndexHtml = assets.some(
        (a) => a.fileName === "index.html" || a.fileName.endsWith("/index.html")
      );

      if (!hasIndexHtml) {
        // Ищем первый HTML файл
        const htmlFile = assets.find((a) => a.mimeType === "text/html");
        if (htmlFile) {
          entryPoint = htmlFile.fileName;
        }
      }

      this.logger.log(
        `Successfully uploaded ${assets.length} files for page ${pageId}`
      );

      return {
        staticPath,
        assets,
        entryPoint,
      };
    } catch (error) {
      this.logger.error(`Error uploading custom page bundle: ${error.message}`);
      throw new Error(`Ошибка загрузки бандла: ${error.message}`);
    }
  }

  /**
   * Удаляет все файлы статической страницы из S3
   * @param assets Список файлов для удаления
   */
  async deleteCustomPageBundle(assets: CustomPageAsset[]): Promise<void> {
    try {
      if (!assets || assets.length === 0) {
        return;
      }

      this.logger.log(
        `Deleting ${assets.length} files from custom page bundle`
      );

      // Формируем URL файлов для удаления
      const fileUrls = assets.map((asset) => {
        const s3Endpoint = process.env.AWS_S3_ENDPOINT;
        const bucket = process.env.AWS_S3_BUCKET || "botmanager-products";
        return `${s3Endpoint}/${bucket}/${asset.s3Key}`;
      });

      await this.s3Service.deleteMultipleFiles(fileUrls);

      this.logger.log(`Successfully deleted custom page bundle`);
    } catch (error) {
      this.logger.error(`Error deleting custom page bundle: ${error.message}`);
      throw error;
    }
  }
}
