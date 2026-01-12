import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DomainResolverController } from "./domain-resolver.controller";
import { DomainResolverService } from "./domain-resolver.service";
import { CustomDomain } from "../../database/entities/custom-domain.entity";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomDomain, Shop, BookingSystem, CustomPage]),
  ],
  controllers: [DomainResolverController],
  providers: [DomainResolverService],
  exports: [DomainResolverService],
})
export class DomainResolverModule {}
