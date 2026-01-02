import {
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  getSchemaPath,
} from "@nestjs/swagger";
import { BookingSystemsService } from "./booking-systems.service";
import {
  PublicBookingSystemResponseDto,
  ErrorResponseDto,
} from "./dto/booking-system-response.dto";

@ApiTags("Публичные системы бронирования")
@Controller("public/booking-systems")
export class PublicBookingSystemsController {
  constructor(private readonly bookingSystemsService: BookingSystemsService) {}

  @Get(":id")
  @ApiOperation({ summary: "Получить публичные данные системы бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Данные системы бронирования",
    schema: { $ref: getSchemaPath(PublicBookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async getPublicData(@Param("id") id: string) {
    return this.bookingSystemsService.getPublicData(id);
  }

  @Get("by-slug/:slug")
  @ApiOperation({ summary: "Получить публичные данные системы бронирования по slug" })
  @ApiParam({ name: "slug", description: "Slug системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Данные системы бронирования",
    schema: { $ref: getSchemaPath(PublicBookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async getPublicDataBySlug(@Param("slug") slug: string) {
    return this.bookingSystemsService.getPublicDataBySlug(slug);
  }

  @Get(":id/specialists")
  @ApiOperation({ summary: "Получить специалистов системы бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Список специалистов",
  })
  async getSpecialists(@Param("id") id: string) {
    const data = await this.bookingSystemsService.getPublicData(id);
    return data.specialists;
  }

  @Get(":id/services")
  @ApiOperation({ summary: "Получить услуги системы бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Список услуг",
  })
  async getServices(@Param("id") id: string) {
    const data = await this.bookingSystemsService.getPublicData(id);
    return data.services;
  }
}

