import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UploadService } from "./upload.service";

@ApiTags("Upload")
@Controller("upload")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("product-images")
  @UseInterceptors(FilesInterceptor("images", 10)) // Максимум 10 файлов
  @ApiOperation({ summary: "Загрузить изображения продукта" })
  @ApiConsumes("multipart/form-data")
  async uploadProductImages(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req: any
  ) {
    if (!files || files.length === 0) {
      return {
        success: false,
        message: "No files uploaded",
        imageUrls: [],
      };
    }

    try {
      const imageUrls = await this.uploadService.uploadProductImages(files);

      return {
        success: true,
        message: `Successfully uploaded ${imageUrls.length} images`,
        imageUrls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        imageUrls: [],
      };
    }
  }

  @Delete("product-images")
  @ApiOperation({ summary: "Удалить изображения продукта" })
  async deleteProductImages(
    @Body() body: { imageUrls: string[] },
    @Request() req: any
  ) {
    if (!body.imageUrls || body.imageUrls.length === 0) {
      return {
        success: false,
        message: "No image URLs provided",
      };
    }

    try {
      await this.uploadService.deleteProductImages(body.imageUrls);

      return {
        success: true,
        message: `Successfully deleted ${body.imageUrls.length} images`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
