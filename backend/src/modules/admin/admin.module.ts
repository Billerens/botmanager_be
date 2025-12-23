import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";

// Entities
import { Admin } from "../../database/entities/admin.entity";
import { AdminActionLog } from "../../database/entities/admin-action-log.entity";
import { User } from "../../database/entities/user.entity";
import { Bot } from "../../database/entities/bot.entity";
import { BotFlow } from "../../database/entities/bot-flow.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Order } from "../../database/entities/order.entity";
import { Lead } from "../../database/entities/lead.entity";

// Services
import { AdminAuthService } from "./services/admin-auth.service";
import { AdminActionLogService } from "./services/admin-action-log.service";
import { PasswordRotationService } from "./services/password-rotation.service";
import { AdminTelegramService } from "./services/admin-telegram.service";

// Controllers
import { AdminAuthController } from "./controllers/admin-auth.controller";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminBotsController } from "./controllers/admin-bots.controller";
import { AdminShopsController } from "./controllers/admin-shops.controller";
import { AdminOrdersController } from "./controllers/admin-orders.controller";
import { AdminLeadsController } from "./controllers/admin-leads.controller";
import { AdminLogsController } from "./controllers/admin-logs.controller";
import { AdminDashboardController } from "./controllers/admin-dashboard.controller";

// Guards & Strategies
import { AdminJwtGuard } from "./guards/admin-jwt.guard";
import { AdminRolesGuard } from "./guards/admin-roles.guard";
import { AdminJwtStrategy } from "./strategies/admin-jwt.strategy";

// Config
import adminConfig from "../../config/admin.config";

// Common services
import { TelegramValidationService } from "../../common/telegram-validation.service";

@Module({
  imports: [
    ConfigModule.forFeature(adminConfig),
    TypeOrmModule.forFeature([
      Admin,
      AdminActionLog,
      User,
      Bot,
      BotFlow,
      Shop,
      Order,
      Lead,
    ]),
    PassportModule.register({ defaultStrategy: "admin-jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          "admin.jwtSecret",
          "admin-super-secret-key-change-in-production"
        ),
        signOptions: {
          expiresIn: configService.get<string>("admin.jwtExpiresIn", "4h"),
        },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminBotsController,
    AdminShopsController,
    AdminOrdersController,
    AdminLeadsController,
    AdminLogsController,
    AdminDashboardController,
  ],
  providers: [
    AdminAuthService,
    AdminActionLogService,
    PasswordRotationService,
    AdminTelegramService,
    AdminJwtStrategy,
    AdminJwtGuard,
    AdminRolesGuard,
    TelegramValidationService,
  ],
  exports: [
    AdminAuthService,
    AdminActionLogService,
    AdminTelegramService,
    TypeOrmModule, // Экспортируем для доступа к репозиториям в других модулях
  ],
})
export class AdminModule {}
