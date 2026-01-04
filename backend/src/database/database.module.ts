import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ALL_ENTITIES } from "./entities";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DATABASE_HOST", "localhost"),
        port: configService.get("DATABASE_PORT", 5432),
        username: configService.get("DATABASE_USERNAME", "botmanager"),
        password: configService.get("DATABASE_PASSWORD", "botmanager_password"),
        database: configService.get("DATABASE_NAME", "botmanager"),
        entities: ALL_ENTITIES,
        // ВАЖНО: synchronize отключен! Используйте миграции для изменения схемы БД
        // Для локальной разработки можно включить через DB_SYNCHRONIZE=true
        synchronize: configService.get("DB_SYNCHRONIZE") === "true",
        logging: false,
        ssl:
          configService.get("NODE_ENV") === "production"
            ? { rejectUnauthorized: false }
            : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
