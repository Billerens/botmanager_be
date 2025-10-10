import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { S3Service } from "../../common/s3.service";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";
import s3Config from "../../config/s3.config";

@Module({
  imports: [
    ConfigModule.forFeature(s3Config),
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new Error("Only image files are allowed"), false);
        }
      },
    }),
  ],
  providers: [S3Service, UploadService],
  controllers: [UploadController],
  exports: [S3Service, UploadService],
})
export class UploadModule {}
