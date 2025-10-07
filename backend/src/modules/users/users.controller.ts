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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto, UpdateUserRoleDto } from './dto/user.dto';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Пользователи')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список всех пользователей' })
  @ApiResponse({ status: 200, description: 'Список пользователей получен' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Поиск пользователей' })
  @ApiQuery({ name: 'q', description: 'Поисковый запрос' })
  @ApiResponse({ status: 200, description: 'Результаты поиска' })
  async search(@Query('q') query: string) {
    return this.usersService.search(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Получить статистику пользователей' })
  @ApiResponse({ status: 200, description: 'Статистика пользователей' })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить пользователя по ID' })
  @ApiResponse({ status: 200, description: 'Пользователь найден' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь обновлен' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Изменить роль пользователя' })
  @ApiResponse({ status: 200, description: 'Роль пользователя изменена' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async updateRole(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(id, updateUserRoleDto);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({ summary: 'Переключить статус активности пользователя' })
  @ApiResponse({ status: 200, description: 'Статус активности изменен' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async toggleActive(@Param('id') id: string) {
    return this.usersService.toggleActive(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь удален' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async remove(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
