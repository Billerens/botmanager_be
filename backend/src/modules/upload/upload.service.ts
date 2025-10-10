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
}
