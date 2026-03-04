import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { SystemSettingsService } from "../../system-settings/system-settings.service";

class UpdateSettingDto {
  @ApiProperty({
    description: "Новое значение настройки (любой JSON)",
    example: ["123456789", "987654321"],
  })
  @IsNotEmpty({ message: "Значение не может быть пустым" })
  value: any;
}

@ApiTags("Admin Settings")
@Controller("admin/settings")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Все системные настройки",
    description: "Возвращает полный список системных настроек",
  })
  @ApiResponse({ status: 200, description: "Список настроек" })
  async getAll() {
    const settings = await this.systemSettingsService.getAll();
    return { settings };
  }

  @Get(":key")
  @ApiOperation({ summary: "Получить настройку по ключу" })
  @ApiResponse({ status: 200, description: "Настройка" })
  @ApiResponse({ status: 404, description: "Настройка не найдена" })
  async getByKey(@Param("key") key: string) {
    const value = await this.systemSettingsService.get(key);
    if (value === undefined) {
      throw new NotFoundException(`Настройка "${key}" не найдена`);
    }
    return { key, value };
  }

  @Put(":key")
  @ApiOperation({ summary: "Обновить системную настройку" })
  @ApiResponse({ status: 200, description: "Обновлённая настройка" })
  async update(@Param("key") key: string, @Body() body: UpdateSettingDto) {
    const setting = await this.systemSettingsService.set(key, body.value);
    return {
      key: setting.key,
      value: setting.value,
      updatedAt: setting.updatedAt,
    };
  }
}
