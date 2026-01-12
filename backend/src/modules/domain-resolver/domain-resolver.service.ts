import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomDomain } from "../../database/entities/custom-domain.entity";
import {
  DomainStatus,
  DomainTargetType,
} from "../custom-domains/enums/domain-status.enum";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";

export interface DomainResolutionResult {
  type: "shop" | "booking" | "custom_page";
  id: string;
  slug?: string;
}

@Injectable()
export class DomainResolverService {
  private readonly logger = new Logger(DomainResolverService.name);

  constructor(
    @InjectRepository(CustomDomain)
    private readonly customDomainsRepo: Repository<CustomDomain>,
    @InjectRepository(Shop)
    private readonly shopsRepo: Repository<Shop>,
    @InjectRepository(BookingSystem)
    private readonly bookingSystemsRepo: Repository<BookingSystem>,
    @InjectRepository(CustomPage)
    private readonly customPagesRepo: Repository<CustomPage>
  ) {}

  /**
   * Резолвит домен в соответствующий ресурс
   * Ищет активный кастомный домен и возвращает информацию о привязанном ресурсе
   */
  async resolveDomain(domain: string): Promise<DomainResolutionResult | null> {
    this.logger.log(`Resolving domain: ${domain}`);

    // Ищем активный кастомный домен
    const customDomain = await this.customDomainsRepo.findOne({
      where: {
        domain,
        status: DomainStatus.ACTIVE,
      },
    });

    if (!customDomain) {
      this.logger.warn(`Domain ${domain} not found or not active`);
      return null;
    }

    // Определяем тип и получаем slug
    switch (customDomain.targetType) {
      case DomainTargetType.SHOP: {
        const shop = await this.shopsRepo.findOne({
          where: { id: customDomain.shopId },
        });

        if (!shop) {
          this.logger.warn(
            `Shop ${customDomain.shopId} not found for domain ${domain}`
          );
          return null;
        }

        return {
          type: "shop",
          id: shop.id,
          slug: shop.slug,
        };
      }

      case DomainTargetType.BOOKING: {
        const bookingSystem = await this.bookingSystemsRepo.findOne({
          where: { id: customDomain.bookingId },
        });

        if (!bookingSystem) {
          this.logger.warn(
            `BookingSystem ${customDomain.bookingId} not found for domain ${domain}`
          );
          return null;
        }

        return {
          type: "booking",
          id: bookingSystem.id,
          slug: bookingSystem.slug,
        };
      }

      case DomainTargetType.CUSTOM_PAGE: {
        const page = await this.customPagesRepo.findOne({
          where: { id: customDomain.customPageId },
        });

        if (!page) {
          this.logger.warn(
            `CustomPage ${customDomain.customPageId} not found for domain ${domain}`
          );
          return null;
        }

        return {
          type: "custom_page",
          id: page.id,
          slug: page.slug,
        };
      }

      default:
        this.logger.warn(
          `Unknown target type ${customDomain.targetType} for domain ${domain}`
        );
        return null;
    }
  }
}
