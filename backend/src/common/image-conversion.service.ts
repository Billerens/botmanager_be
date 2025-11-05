import { Injectable, Logger } from "@nestjs/common";
import * as sharp from "sharp";

export interface ImageConversionOptions {
  quality?: number; // Качество от 1 до 100 (по умолчанию 80)
  maxWidth?: number; // Максимальная ширина (опционально)
  maxHeight?: number; // Максимальная высота (опционально)
}

@Injectable()
export class ImageConversionService {
  private readonly logger = new Logger(ImageConversionService.name);
  private readonly defaultQuality = 80;
  private readonly defaultMaxWidth = 1920;
  private readonly defaultMaxHeight = 1920;

  /**
   * Конвертирует изображение в формат WebP
   * @param buffer Буфер исходного изображения
   * @param options Опции конвертации
   * @returns Буфер изображения в формате WebP
   */
  async convertToWebP(
    buffer: Buffer,
    options: ImageConversionOptions = {}
  ): Promise<Buffer> {
    try {
      const {
        quality = this.defaultQuality,
        maxWidth = this.defaultMaxWidth,
        maxHeight = this.defaultMaxHeight,
      } = options;

      // Проверяем, является ли файл изображением
      const metadata = await sharp(buffer).metadata();
      
      if (!metadata.format) {
        throw new Error("Невозможно определить формат изображения");
      }

      this.logger.log(
        `Converting image from ${metadata.format} to WebP (${metadata.width}x${metadata.height})`
      );

      // Создаем pipeline для конвертации
      let pipeline = sharp(buffer);

      // Применяем ресайз, если нужно
      if (metadata.width && metadata.height) {
        const shouldResize =
          metadata.width > maxWidth || metadata.height > maxHeight;

        if (shouldResize) {
          pipeline = pipeline.resize(maxWidth, maxHeight, {
            fit: "inside",
            withoutEnlargement: true,
          });
          this.logger.log(
            `Resizing image to max ${maxWidth}x${maxHeight}`
          );
        }
      }

      // Конвертируем в WebP
      const webpBuffer = await pipeline
        .webp({
          quality,
          effort: 4, // Баланс между качеством и скоростью (0-6)
        })
        .toBuffer();

      const originalSize = buffer.length;
      const convertedSize = webpBuffer.length;
      const compressionRatio = (
        ((originalSize - convertedSize) / originalSize) *
        100
      ).toFixed(2);

      this.logger.log(
        `Image converted successfully. Original: ${this.formatBytes(originalSize)}, WebP: ${this.formatBytes(convertedSize)}, Compression: ${compressionRatio}%`
      );

      return webpBuffer;
    } catch (error) {
      this.logger.error(`Error converting image to WebP: ${error.message}`);
      throw new Error(`Failed to convert image to WebP: ${error.message}`);
    }
  }

  /**
   * Конвертирует несколько изображений в WebP
   * @param buffers Массив буферов изображений
   * @param options Опции конвертации
   * @returns Массив буферов изображений в формате WebP
   */
  async convertMultipleToWebP(
    buffers: Buffer[],
    options: ImageConversionOptions = {}
  ): Promise<Buffer[]> {
    const conversionPromises = buffers.map((buffer) =>
      this.convertToWebP(buffer, options)
    );

    return Promise.all(conversionPromises);
  }

  /**
   * Проверяет, является ли файл изображением
   * @param buffer Буфер файла
   * @returns true, если файл является изображением
   */
  async isImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!metadata.format;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получает метаданные изображения
   * @param buffer Буфер изображения
   * @returns Метаданные изображения
   */
  async getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    try {
      return await sharp(buffer).metadata();
    } catch (error) {
      this.logger.error(`Error getting image metadata: ${error.message}`);
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  /**
   * Форматирует размер в байтах в читаемый формат
   * @param bytes Размер в байтах
   * @returns Отформатированная строка
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}

