import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { CustomDomain } from "../../database/entities/custom-domain.entity";
import { CustomDomainsController } from "./custom-domains.controller";
import { CustomDomainsService } from "./services/custom-domains.service";
import { DnsValidatorService } from "./services/dns-validator.service";
import { CaddyService } from "./services/caddy.service";
import { DomainHealthService } from "./services/domain-health.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomDomain]),
    ScheduleModule.forRoot(),
  ],
  controllers: [CustomDomainsController],
  providers: [
    CustomDomainsService,
    DnsValidatorService,
    CaddyService,
    DomainHealthService,
  ],
  exports: [CustomDomainsService, CaddyService],
})
export class CustomDomainsModule {}

