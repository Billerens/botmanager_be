import { Injectable, Logger } from "@nestjs/common";
import { S3Service } from "../../common/s3.service";
import { ImageConversionService } from "../../common/image-conversion.service";

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
}
