import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PublicUser } from "../../database/entities/public-user.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Shop } from "../../database/entities/shop.entity";
import { PublicAuthService } from "./public-auth.service";
import { PublicAuthController } from "./public-auth.controller";
import { PublicUserGuard } from "./guards/public-user.guard";
import { PublicAccessGuard } from "./guards/public-access.guard";
import { TelegramInitDataValidationService } from "../../common/telegram-initdata-validation.service";
import { BotsModule } from "../bots/bots.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PublicUser, Bot, Shop]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "15m",
        },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => BotsModule),
    MailModule,
  ],
  controllers: [PublicAuthController],
  providers: [
    PublicAuthService,
    PublicUserGuard,
    PublicAccessGuard,
    TelegramInitDataValidationService,
  ],
  exports: [
    PublicAuthService,
    PublicUserGuard,
    PublicAccessGuard,
    TelegramInitDataValidationService,
    TypeOrmModule,
  ],
})
export class PublicAuthModule {}
