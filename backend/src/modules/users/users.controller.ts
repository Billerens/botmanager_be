import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  getSchemaPath,
} from "@nestjs/swagger";

import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UpdateUserDto, UpdateUserRoleDto } from "./dto/user.dto";
import { UserRole } from "../../database/entities/user.entity";
import {
  UserResponseDto,
  UserStatsResponseDto,
  ErrorResponseDto,
  UpdateRoleResponseDto,
  ToggleActiveResponseDto,
  DeleteResponseDto,
} from "./dto/user-response.dto";

@ApiTags("Пользователи")
@Controller("users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Получить список всех пользователей" })
  @ApiResponse({
    status: 200,
    description: "Список пользователей получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(UserResponseDto),
      },
    },
  })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get("search")
  @ApiOperation({ summary: "Поиск пользователей" })
  @ApiQuery({ name: "q", description: "Поисковый запрос" })
  @ApiResponse({
    status: 200,
    description: "Результаты поиска",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(UserResponseDto),
      },
    },
  })
  async search(@Query("q") query: string) {
    return this.usersService.search(query);
  }

  @Get("stats")
  @ApiOperation({ summary: "Получить статистику пользователей" })
  @ApiResponse({
    status: 200,
    description: "Статистика пользователей",
    schema: {
      $ref: getSchemaPath(UserStatsResponseDto),
    },
  })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить пользователя по ID" })
  @ApiResponse({
    status: 200,
    description: "Пользователь найден",
    schema: {
      $ref: getSchemaPath(UserResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить пользователя" })
  @ApiResponse({
    status: 200,
    description: "Пользователь обновлен",
    schema: {
      $ref: getSchemaPath(UserResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, updateUserDto, req.user.id);
  }

  @Patch(":id/role")
  @ApiOperation({ summary: "Изменить роль пользователя" })
  @ApiResponse({
    status: 200,
    description: "Роль пользователя изменена",
    schema: {
      $ref: getSchemaPath(UpdateRoleResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async updateRole(
    @Param("id") id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
    @Request() req
  ) {
    return this.usersService.updateRole(id, updateUserRoleDto, req.user.id);
  }

  @Patch(":id/toggle-active")
  @ApiOperation({ summary: "Переключить статус активности пользователя" })
  @ApiResponse({
    status: 200,
    description: "Статус активности изменен",
    schema: {
      $ref: getSchemaPath(ToggleActiveResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async toggleActive(@Param("id") id: string, @Request() req) {
    return this.usersService.toggleActive(id, req.user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить пользователя" })
  @ApiResponse({
    status: 200,
    description: "Пользователь удален",
    schema: {
      $ref: getSchemaPath(DeleteResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async remove(@Param("id") id: string, @Request() req) {
    return this.usersService.delete(id, req.user.id);
  }
}
