import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { FilesInterceptor, FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UploadService } from "./upload.service";
import { UploadResponseDto } from "./dto/upload-response.dto";

@ApiTags("Загрузка файлов")
@Controller("upload")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("product-images")
  @UseInterceptors(FilesInterceptor("images", 10)) // Максимум 10 файлов
  @ApiOperation({ summary: "Загрузить изображения продукта" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 200,
    description: "Изображения продукта загружены",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Successfully uploaded 3 images",
        },
        imageUrls: {
          type: "array",
          items: {
            $ref: getSchemaPath(UploadResponseDto),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка загрузки файлов",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: false,
        },
        message: {
          type: "string",
          example: "No files uploaded",
        },
        imageUrls: {
          type: "array",
          items: {
            type: "string",
          },
          example: [],
        },
      },
    },
  })
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
  @ApiResponse({
    status: 200,
    description: "Изображения продукта удалены",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Successfully deleted 2 images",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка удаления файлов",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: false,
        },
        message: {
          type: "string",
          example: "No image URLs provided",
        },
      },
    },
  })
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

  @Post("shop-logo")
  @UseInterceptors(FileInterceptor("logo"))
  @ApiOperation({ summary: "Загрузить логотип магазина" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 200,
    description: "Логотип магазина загружен",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Successfully uploaded shop logo",
        },
        imageUrls: {
          type: "array",
          items: {
            $ref: getSchemaPath(UploadResponseDto),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка загрузки логотипа",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: false,
        },
        message: {
          type: "string",
          example: "No file uploaded",
        },
        imageUrls: {
          type: "array",
          items: {
            type: "string",
          },
          example: [],
        },
      },
    },
  })
  async uploadShopLogo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (!file) {
      return {
        success: false,
        message: "No file uploaded",
        imageUrls: [],
      };
    }

    try {
      const imageUrl = await this.uploadService.uploadShopLogo(file);

      return {
        success: true,
        message: "Successfully uploaded shop logo",
        imageUrls: [imageUrl],
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        imageUrls: [],
      };
    }
  }

  @Post("booking-logo")
  @UseInterceptors(FileInterceptor("logo"))
  @ApiOperation({ summary: "Загрузить логотип системы бронирования" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 200,
    description: "Логотип системы бронирования загружен",
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка загрузки логотипа",
  })
  async uploadBookingLogo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (!file) {
      return {
        success: false,
        message: "No file uploaded",
        imageUrls: [],
      };
    }

    try {
      const imageUrl = await this.uploadService.uploadBookingLogo(file);

      return {
        success: true,
        message: "Successfully uploaded booking logo",
        imageUrls: [imageUrl],
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        imageUrls: [],
      };
    }
  }

  @Post("specialist-avatar")
  @UseInterceptors(FileInterceptor("avatar"))
  @ApiOperation({ summary: "Загрузить аватар специалиста" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 200,
    description: "Аватар специалиста загружен",
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка загрузки аватара",
  })
  async uploadSpecialistAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (!file) {
      return {
        success: false,
        message: "No file uploaded",
        imageUrls: [],
      };
    }

    try {
      const imageUrl = await this.uploadService.uploadSpecialistAvatar(file);

      return {
        success: true,
        message: "Successfully uploaded specialist avatar",
        imageUrls: [imageUrl],
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        imageUrls: [],
      };
    }
  }

  @Post("service-image")
  @UseInterceptors(FileInterceptor("image"))
  @ApiOperation({ summary: "Загрузить изображение услуги" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 200,
    description: "Изображение услуги загружено",
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка загрузки изображения",
  })
  async uploadServiceImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (!file) {
      return {
        success: false,
        message: "No file uploaded",
        imageUrls: [],
      };
    }

    try {
      const imageUrl = await this.uploadService.uploadServiceImage(file);

      return {
        success: true,
        message: "Successfully uploaded service image",
        imageUrls: [imageUrl],
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        imageUrls: [],
      };
    }
  }

  @Post("message-image")
  @UseInterceptors(FileInterceptor("image"))
  @ApiOperation({ summary: "Загрузить изображение сообщения/рассылки" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 200,
    description: "Изображение сообщения загружено",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Successfully uploaded message image",
        },
        imageUrls: {
          type: "array",
          items: {
            type: "string",
          },
          example: ["https://example.com/uploads/message-image.jpg"],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка загрузки изображения",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: false,
        },
        message: {
          type: "string",
          example: "No file uploaded",
        },
        imageUrls: {
          type: "array",
          items: {
            type: "string",
          },
          example: [],
        },
      },
    },
  })
  async uploadMessageImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (!file) {
      return {
        success: false,
        message: "No file uploaded",
        imageUrls: [],
      };
    }

    try {
      const imageUrl = await this.uploadService.uploadMessageImage(file);

      return {
        success: true,
        message: "Successfully uploaded message image",
        imageUrls: [imageUrl],
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        imageUrls: [],
      };
    }
  }
}
