import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomCollectionSchema } from "../../database/entities/custom-collection-schema.entity";
import { CustomData } from "../../database/entities/custom-data.entity";
import { PublicApiKey } from "../../database/entities/public-api-key.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { CustomDataService } from "./custom-data.service";
import { CustomDataController } from "./custom-data.controller";
import { PublicCustomDataController } from "./public-custom-data.controller";
import { ApiKeysController } from "./api-keys.controller";
import { PublicApiKeyService } from "./public-api-key.service";
import { PublicCustomDataService } from "./public-custom-data.service";
import { CustomLoggerService } from "../../common/logger.service";
import { CustomDataOwnershipGuard } from "./guards/custom-data-ownership.guard";
import { PublicApiKeyGuard } from "./guards/public-api-key.guard";
import { BotsModule } from "../bots/bots.module";
import { PublicAuthModule } from "../public-auth/public-auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomCollectionSchema,
      CustomData,
      PublicApiKey,
      Bot,
      Shop,
      BookingSystem,
      CustomPage,
    ]),
    forwardRef(() => BotsModule), // Для BotPermissionsService
    PublicAuthModule, // Для JwtService (браузерная аутентификация)
  ],
  controllers: [
    CustomDataController,
    PublicCustomDataController,
    ApiKeysController,
  ],
  providers: [
    CustomDataService,
    PublicApiKeyService,
    PublicCustomDataService,
    CustomLoggerService,
    CustomDataOwnershipGuard,
    PublicApiKeyGuard,
  ],
  exports: [CustomDataService, PublicApiKeyService],
})
export class CustomDataModule {}
