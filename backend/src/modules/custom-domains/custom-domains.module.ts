import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomDomain } from "../../database/entities/custom-domain.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Bot } from "../../database/entities/bot.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { CustomDomainsController } from "./custom-domains.controller";
import { CustomDomainsService } from "./services/custom-domains.service";
import { DnsValidatorService } from "./services/dns-validator.service";
import { CaddyService } from "./services/caddy.service";
import { DomainHealthService } from "./services/domain-health.service";
import { TimewebDnsService } from "./services/timeweb-dns.service";
import { SubdomainService } from "./services/subdomain.service";
import { SubdomainHealthService } from "./services/subdomain-health.service";

@Module({
  imports: [
    // ScheduleModule.forRoot() уже подключен глобально в app.module.ts
    TypeOrmModule.forFeature([CustomDomain, Shop, Bot, CustomPage]),
  ],
  controllers: [CustomDomainsController],
  providers: [
    CustomDomainsService,
    DnsValidatorService,
    CaddyService,
    DomainHealthService,
    TimewebDnsService,
    SubdomainService,
    SubdomainHealthService,
  ],
  exports: [
    CustomDomainsService,
    CaddyService,
    SubdomainService,
    TimewebDnsService,
  ],
})
export class CustomDomainsModule {}
