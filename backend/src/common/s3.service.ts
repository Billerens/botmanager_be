import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    const s3Config = this.configService.get("s3");

    this.s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      endpoint: s3Config.endpoint,
      forcePathStyle: s3Config.forcePathStyle,
    });

    this.bucket = s3Config.bucket;
  }

  /**
   * Загружает файл в S3
   */
  async uploadFile(
    file: Buffer,
    originalName: string,
    contentType: string,
    folder: string = "products"
  ): Promise<string> {
    try {
      const fileExtension = originalName.split(".").pop();
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        Body: file,
        ContentType: contentType,
        ACL: "public-read", // Делаем файл публично доступным
      });

      await this.s3Client.send(command);

      const fileUrl = this.getFileUrl(fileName);
      this.logger.log(`File uploaded successfully: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Загружает файл в S3 с сохранением оригинального пути (для static pages)
   */
  async uploadFileWithPath(
    file: Buffer,
    s3Key: string,
    contentType: string
  ): Promise<string> {
    try {
      const commandInput: any = {
        Bucket: this.bucket,
        Key: s3Key,
        Body: file,
        ContentType: contentType,
        ACL: "public-read",
      };

      // Для Brotli-сжатых файлов устанавливаем правильные заголовки
      if (s3Key.endsWith(".br")) {
        // Определяем оригинальный Content-Type без .br расширения
        const originalContentType = this.getContentTypeForBrotliFile(s3Key);
        commandInput.ContentType = originalContentType;
        commandInput.ContentEncoding = "br";

        this.logger.debug(
          `Uploading Brotli file: ${s3Key}, Content-Type: ${originalContentType}, Content-Encoding: br`
        );
      }

      const command = new PutObjectCommand(commandInput);

      await this.s3Client.send(command);

      const fileUrl = this.getFileUrl(s3Key);
      this.logger.log(`File uploaded successfully: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(`Error uploading file with path: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Удаляет файл из S3
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const fileName = this.extractFileNameFromUrl(fileUrl);

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${fileName}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Генерирует presigned URL для загрузки файла
   */
  async generatePresignedUploadUrl(
    fileName: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return presignedUrl;
    } catch (error) {
      this.logger.error(`Error generating presigned URL: ${error.message}`);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Получает публичный URL файла
   */
  getFileUrl(fileName: string): string {
    const s3Config = this.configService.get("s3");

    if (s3Config.endpoint) {
      // Для MinIO или других S3-совместимых хранилищ
      return `${s3Config.endpoint}/${this.bucket}/${fileName}`;
    } else {
      // Для AWS S3
      return `https://${this.bucket}.s3.${s3Config.region}.amazonaws.com/${fileName}`;
    }
  }

  /**
   * Извлекает имя файла из URL
   */
  private extractFileNameFromUrl(fileUrl: string): string {
    const url = new URL(fileUrl);
    return url.pathname.substring(1); // Убираем первый слеш
  }

  /**
   * Определяет правильный Content-Type для Brotli-сжатого файла
   */
  private getContentTypeForBrotliFile(s3Key: string): string {
    // Убираем .br расширение и определяем тип по оригинальному имени файла
    const originalKey = s3Key.replace(/\.br$/, "");
    const fileName = originalKey.split("/").pop() || "";

    // Определяем Content-Type на основе расширения файла
    if (fileName.endsWith(".js")) {
      return "application/javascript";
    } else if (fileName.endsWith(".css")) {
      return "text/css";
    } else if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
      return "text/html";
    } else if (fileName.endsWith(".json")) {
      return "application/json";
    } else if (fileName.endsWith(".svg")) {
      return "image/svg+xml";
    } else if (fileName.endsWith(".woff2")) {
      return "font/woff2";
    } else if (fileName.endsWith(".woff")) {
      return "font/woff";
    } else if (fileName.endsWith(".ttf")) {
      return "font/ttf";
    } else if (fileName.endsWith(".png")) {
      return "image/png";
    } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
      return "image/jpeg";
    } else if (fileName.endsWith(".webp")) {
      return "image/webp";
    } else if (fileName.endsWith(".ico")) {
      return "image/x-icon";
    } else {
      // По умолчанию используем application/octet-stream для неизвестных типов
      return "application/octet-stream";
    }
  }

  /**
   * Загружает несколько файлов
   */
  async uploadMultipleFiles(
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
    folder: string = "products"
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file.buffer, file.originalname, file.mimetype, folder)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Удаляет несколько файлов
   */
  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    const deletePromises = fileUrls.map((url) => this.deleteFile(url));
    await Promise.all(deletePromises);
  }

  /**
   * Получает список файлов из S3 bucket
   * @param prefix Префикс для фильтрации (например, "products/", "shop-logos/")
   * @param maxKeys Максимальное количество файлов для возврата
   * @param continuationToken Токен для пагинации
   * @returns Список файлов с метаданными
   */
  async listFiles(
    prefix?: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<{
    files: Array<{
      key: string;
      url: string;
      size: number;
      lastModified: Date;
      contentType?: string;
      folder: string;
    }>;
    isTruncated: boolean;
    nextContinuationToken?: string;
    keyCount: number;
  }> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      });

      const response = await this.s3Client.send(command);

      const files =
        response.Contents?.map((object) => {
          const key = object.Key || "";
          const folder = key.split("/")[0] || "";

          return {
            key,
            url: this.getFileUrl(key),
            size: object.Size || 0,
            lastModified: object.LastModified || new Date(),
            contentType: undefined, // ContentType не возвращается в ListObjectsV2
            folder,
          };
        }) || [];

      return {
        files,
        isTruncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
        keyCount: response.KeyCount || 0,
      };
    } catch (error) {
      this.logger.error(`Error listing files: ${error.message}`);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Получает метаданные файла из S3
   * @param fileUrl URL файла
   * @returns Метаданные файла
   */
  async getFileMetadata(fileUrl: string): Promise<{
    key: string;
    url: string;
    size: number;
    lastModified: Date;
    contentType: string;
    folder: string;
  }> {
    try {
      const key = this.extractFileNameFromUrl(fileUrl);
      const folder = key.split("/")[0] || "";

      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        key,
        url: fileUrl,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType || "application/octet-stream",
        folder,
      };
    } catch (error) {
      this.logger.error(`Error getting file metadata: ${error.message}`);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Получает статистику хранилища по папкам
   * @returns Статистика по папкам
   */
  async getStorageStats(): Promise<{
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
  }> {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byFolder: {} as Record<
          string,
          {
            count: number;
            size: number;
          }
        >,
        byType: {} as Record<
          string,
          {
            count: number;
            size: number;
          }
        >,
      };

      let continuationToken: string | undefined;
      let hasMore = true;

      // Получаем все файлы по частям (пагинация)
      while (hasMore) {
        const result = await this.listFiles(undefined, 1000, continuationToken);

        for (const file of result.files) {
          stats.totalFiles++;
          stats.totalSize += file.size;

          // Статистика по папкам
          if (!stats.byFolder[file.folder]) {
            stats.byFolder[file.folder] = { count: 0, size: 0 };
          }
          stats.byFolder[file.folder].count++;
          stats.byFolder[file.folder].size += file.size;

          // Статистика по типам (определяем по расширению)
          const extension = file.key.split(".").pop()?.toLowerCase() || "unknown";
          const type = this.getFileTypeByExtension(extension);
          if (!stats.byType[type]) {
            stats.byType[type] = { count: 0, size: 0 };
          }
          stats.byType[type].count++;
          stats.byType[type].size += file.size;
        }

        hasMore = result.isTruncated;
        continuationToken = result.nextContinuationToken;
      }

      return stats;
    } catch (error) {
      this.logger.error(`Error getting storage stats: ${error.message}`);
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }

  /**
   * Определяет тип файла по расширению
   */
  private getFileTypeByExtension(extension: string): string {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico"];
    const documentExtensions = ["pdf", "doc", "docx", "txt"];
    const videoExtensions = ["mp4", "avi", "mov", "webm"];
    const audioExtensions = ["mp3", "wav", "ogg"];

    if (imageExtensions.includes(extension)) return "image";
    if (documentExtensions.includes(extension)) return "document";
    if (videoExtensions.includes(extension)) return "video";
    if (audioExtensions.includes(extension)) return "audio";
    if (extension === "html" || extension === "htm") return "html";
    if (extension === "css") return "css";
    if (extension === "js") return "javascript";
    if (extension === "json") return "json";
    if (["woff", "woff2", "ttf", "otf"].includes(extension)) return "font";

    return "other";
  }
}
