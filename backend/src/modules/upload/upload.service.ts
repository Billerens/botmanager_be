import { Injectable, Logger } from "@nestjs/common";
import { S3Service } from "../../common/s3.service";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Загружает изображения продукта в S3
   */
  async uploadProductImages(
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>
  ): Promise<string[]> {
    try {
      this.logger.log(`Uploading ${files.length} product images`);

      const imageUrls = await this.s3Service.uploadMultipleFiles(
        files,
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
   * Загружает логотип магазина в S3
   */
  async uploadShopLogo(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading shop logo: ${file.originalname}`);

      const imageUrl = await this.s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
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
   * Загружает логотип системы бронирования в S3
   */
  async uploadBookingLogo(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading booking logo: ${file.originalname}`);

      const imageUrl = await this.s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
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
   * Загружает аватар специалиста в S3
   */
  async uploadSpecialistAvatar(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading specialist avatar: ${file.originalname}`);

      const imageUrl = await this.s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
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
   * Загружает изображение услуги в S3
   */
  async uploadServiceImage(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading service image: ${file.originalname}`);

      const imageUrl = await this.s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
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
   * Загружает изображение сообщения/рассылки в S3
   */
  async uploadMessageImage(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      this.logger.log(`Uploading message image: ${file.originalname}`);

      const imageUrl = await this.s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
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
