import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Admin, AdminStatus } from "../../../database/entities/admin.entity";
import { AdminJwtPayload } from "../interfaces/admin-jwt-payload.interface";

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, "admin-jwt") {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        "admin.jwtSecret",
        "admin-super-secret-key-change-in-production"
      ),
    });
  }

  async validate(payload: AdminJwtPayload): Promise<Admin> {
    // Проверяем, что это токен админа
    if (!payload.isAdmin) {
      throw new UnauthorizedException("Недействительный токен администратора");
    }

    const admin = await this.adminRepository.findOne({
      where: { id: payload.sub },
    });

    if (!admin) {
      throw new UnauthorizedException("Администратор не найден");
    }

    if (!admin.isActive) {
      throw new UnauthorizedException("Аккаунт администратора деактивирован");
    }

    if (admin.status === AdminStatus.INACTIVE) {
      throw new UnauthorizedException("Аккаунт администратора неактивен");
    }

    // Обновляем время последней активности
    admin.lastActivityAt = new Date();
    await this.adminRepository.save(admin);

    return admin;
  }
}

