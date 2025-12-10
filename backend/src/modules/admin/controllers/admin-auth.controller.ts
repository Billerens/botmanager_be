import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";

import { Admin, AdminRole } from "../../../database/entities/admin.entity";
import { AdminAuthService } from "../services/admin-auth.service";
import { AdminActionLogService } from "../services/admin-action-log.service";
import { PasswordRotationService } from "../services/password-rotation.service";
import { AdminJwtGuard, AdminPublic, AdminRoles } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import {
  AdminLoginDto,
  CreateAdminDto,
  UpdateAdminDto,
  ChangeAdminPasswordDto,
  ResetAdminPasswordDto,
  PasswordRotationSettingsDto,
} from "../dto/admin.dto";

// Расширяем Request для типизации
interface AdminRequest extends Request {
  user: Admin;
}

@Controller("admin/auth")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminAuthController {
  constructor(
    private adminAuthService: AdminAuthService,
    private actionLogService: AdminActionLogService,
    private passwordRotationService: PasswordRotationService
  ) {}

  @Post("login")
  @AdminPublic()
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: AdminLoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return this.adminAuthService.login(loginDto, ipAddress, userAgent);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: AdminRequest) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    await this.adminAuthService.logout(req.user, ipAddress, userAgent);
    return { message: "Выход выполнен успешно" };
  }

  @Get("me")
  async getMe(@Req() req: AdminRequest) {
    return req.user;
  }

  @Put("me/password")
  async changeMyPassword(
    @Req() req: AdminRequest,
    @Body() changeDto: ChangeAdminPasswordDto
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    await this.adminAuthService.changePassword(req.user, changeDto, ipAddress);
    return { message: "Пароль успешно изменен" };
  }

  // Управление 2FA
  @Post("2fa/setup")
  async setupTwoFactor(@Req() req: AdminRequest) {
    return this.adminAuthService.setupTwoFactor(req.user);
  }

  @Post("2fa/enable")
  async enableTwoFactor(@Req() req: AdminRequest, @Body("code") code: string) {
    const backupCodes = await this.adminAuthService.enableTwoFactor(
      req.user,
      code
    );
    return { message: "2FA включена", backupCodes };
  }

  @Post("2fa/disable")
  async disableTwoFactor(@Req() req: AdminRequest, @Body("code") code: string) {
    await this.adminAuthService.disableTwoFactor(req.user, code);
    return { message: "2FA отключена" };
  }

  // Управление администраторами (только для superadmin)
  @Get("admins")
  @AdminRoles(AdminRole.SUPERADMIN)
  async getAllAdmins() {
    return this.adminAuthService.findAll();
  }

  @Get("admins/:id")
  @AdminRoles(AdminRole.SUPERADMIN)
  async getAdmin(@Param("id") id: string) {
    return this.adminAuthService.findById(id);
  }

  @Post("admins")
  @AdminRoles(AdminRole.SUPERADMIN)
  async createAdmin(
    @Body() createDto: CreateAdminDto,
    @Req() req: AdminRequest
  ) {
    return this.adminAuthService.createAdmin(createDto, req.user);
  }

  @Put("admins/:id")
  @AdminRoles(AdminRole.SUPERADMIN)
  async updateAdmin(
    @Param("id") id: string,
    @Body() updateDto: UpdateAdminDto,
    @Req() req: AdminRequest
  ) {
    return this.adminAuthService.updateAdmin(id, updateDto, req.user);
  }

  @Delete("admins/:id")
  @AdminRoles(AdminRole.SUPERADMIN)
  async deleteAdmin(@Param("id") id: string, @Req() req: AdminRequest) {
    await this.adminAuthService.deleteAdmin(id, req.user);
    return { message: "Администратор удален" };
  }

  @Post("admins/:id/reset-password")
  @AdminRoles(AdminRole.SUPERADMIN)
  async resetAdminPassword(@Param("id") id: string, @Req() req: AdminRequest) {
    const newPassword = await this.adminAuthService.resetAdminPassword(
      id,
      req.user
    );
    return {
      message: "Пароль сброшен и отправлен администратору",
      // В продакшене не возвращаем пароль в ответе
      ...(process.env.NODE_ENV === "development" && { newPassword }),
    };
  }

  // Ротация паролей
  @Get("password-rotation/status")
  @AdminRoles(AdminRole.SUPERADMIN)
  async getRotationStatus() {
    return this.passwordRotationService.getRotationStatus();
  }

  @Put("admins/:id/password-rotation")
  @AdminRoles(AdminRole.SUPERADMIN)
  async updateRotationSettings(
    @Param("id") id: string,
    @Body() settingsDto: PasswordRotationSettingsDto
  ) {
    return this.passwordRotationService.updateRotationSettings(
      id,
      settingsDto.rotationDays,
      settingsDto.recipientTelegramId
    );
  }

  @Post("admins/:id/rotate-password")
  @AdminRoles(AdminRole.SUPERADMIN)
  async rotatePassword(@Param("id") id: string, @Req() req: AdminRequest) {
    const admin = await this.adminAuthService.findById(id);
    await this.passwordRotationService.rotatePassword(admin);
    return { message: "Пароль изменен и отправлен получателю" };
  }
}

