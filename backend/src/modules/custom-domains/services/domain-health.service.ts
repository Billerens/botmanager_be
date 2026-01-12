import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { CustomDomain } from "../../../database/entities/custom-domain.entity";
import { DomainStatus } from "../enums/domain-status.enum";
import { DnsValidatorService } from "./dns-validator.service";

@Injectable()
export class DomainHealthService {
  private readonly logger = new Logger(DomainHealthService.name);

  constructor(
    @InjectRepository(CustomDomain)
    private readonly domainsRepo: Repository<CustomDomain>,
    private readonly dnsValidator: DnsValidatorService
  ) {}

  /**
   * Проверка здоровья всех активных доменов каждые 6 часов
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async checkAllDomainsHealth(): Promise<void> {
    this.logger.log("Starting domain health check...");

    const activeDomains = await this.domainsRepo.find({
      where: {
        status: In([DomainStatus.ACTIVE, DomainStatus.SSL_EXPIRING]),
      },
      relations: ["user"],
    });

    this.logger.log(`Found ${activeDomains.length} active domains to check`);

    for (const domain of activeDomains) {
      try {
        await this.checkDomainHealth(domain);
      } catch (error) {
        this.logger.error(`Failed to check health for ${domain.domain}`, error);
      }
    }

    this.logger.log("Domain health check completed");
  }

  /**
   * Проверка здоровья конкретного домена
   */
  async checkDomainHealth(domain: CustomDomain): Promise<void> {
    // 1. Проверяем DNS
    const dnsResult = await this.dnsValidator.validateDns(domain.domain);

    if (!dnsResult.isValid) {
      await this.handleDnsFailure(domain, dnsResult.errors[0]?.message);
      return;
    }

    // DNS в порядке, сбрасываем счётчик неудач
    domain.consecutiveFailures = 0;

    // 2. Проверяем SSL
    const sslInfo = await this.dnsValidator.getSslCertificateInfo(
      domain.domain
    );

    if (sslInfo) {
      domain.sslExpiresAt = sslInfo.expiresAt;
      domain.lastSslCheck = {
        timestamp: new Date(),
        success: true,
        daysUntilExpiry: sslInfo.daysUntilExpiry,
      };

      await this.handleSslStatus(domain, sslInfo.daysUntilExpiry);
    } else {
      domain.lastSslCheck = {
        timestamp: new Date(),
        success: false,
        error: "Не удалось получить информацию о сертификате",
      };
    }

    await this.domainsRepo.save(domain);
  }

  /**
   * Обработка неудачной проверки DNS
   */
  private async handleDnsFailure(
    domain: CustomDomain,
    errorMessage: string
  ): Promise<void> {
    domain.consecutiveFailures++;

    this.logger.warn(
      `DNS check failed for ${domain.domain}: ${errorMessage} (failure #${domain.consecutiveFailures})`
    );

    if (domain.consecutiveFailures >= 3) {
      // 3 неудачные проверки подряд - приостанавливаем домен
      await this.suspendDomain(domain, "DNS больше не указывает на наш сервер");
    } else {
      // Добавляем предупреждение
      if (
        !domain.warnings.some((w) => w.code === "DNS_ISSUE") &&
        !domain.notificationsSent.includes("dns_warning")
      ) {
        domain.warnings.push({
          code: "DNS_ISSUE",
          message: `Обнаружена проблема с DNS: ${errorMessage}`,
          timestamp: new Date(),
        });
        domain.notificationsSent.push("dns_warning");
        // TODO: Отправить уведомление пользователю
      }
    }

    await this.domainsRepo.save(domain);
  }

  /**
   * Обработка статуса SSL
   */
  private async handleSslStatus(
    domain: CustomDomain,
    daysUntilExpiry: number
  ): Promise<void> {
    if (daysUntilExpiry <= 0) {
      // SSL истёк
      domain.status = DomainStatus.SSL_ERROR;
      domain.errors.push({
        code: "SSL_EXPIRED",
        message: "SSL-сертификат истёк",
        timestamp: new Date(),
        resolved: false,
      });

      this.logger.error(`SSL expired for ${domain.domain}`);
      // SSL обновляется фронтенд-сервером через on-demand TLS
    } else if (daysUntilExpiry <= 7) {
      // Критично - SSL истекает через 7 дней или меньше
      domain.status = DomainStatus.SSL_EXPIRING;

      if (!domain.notificationsSent.includes("ssl_critical")) {
        this.logger.warn(
          `SSL for ${domain.domain} expires in ${daysUntilExpiry} days (critical)`
        );
        domain.notificationsSent.push("ssl_critical");
        // TODO: Отправить критическое уведомление пользователю
      }
      // SSL обновляется фронтенд-сервером через on-demand TLS
    } else if (daysUntilExpiry <= 14) {
      // Предупреждение - SSL истекает через 14 дней
      if (!domain.notificationsSent.includes("ssl_warning_14d")) {
        this.logger.log(
          `SSL for ${domain.domain} expires in ${daysUntilExpiry} days`
        );

        domain.warnings.push({
          code: "SSL_EXPIRING_SOON",
          message: `SSL-сертификат истекает через ${daysUntilExpiry} дней`,
          timestamp: new Date(),
        });
        domain.notificationsSent.push("ssl_warning_14d");
        // TODO: Отправить предупреждение пользователю
      }
    } else if (daysUntilExpiry <= 30) {
      // Информационно - фронтенд-сервер должен обновить SSL автоматически
      this.logger.debug(
        `SSL for ${domain.domain} expires in ${daysUntilExpiry} days (normal renewal window)`
      );
    }
  }

  /**
   * Приостановить домен
   */
  private async suspendDomain(
    domain: CustomDomain,
    reason: string
  ): Promise<void> {
    this.logger.warn(`Suspending domain ${domain.domain}: ${reason}`);

    domain.status = DomainStatus.SUSPENDED;
    domain.suspendedAt = new Date();
    domain.suspendReason = reason;

    // При новой архитектуре маршруты не управляются через Caddy API
    // Приостановленный домен просто не пройдёт проверку в isDomainAllowedForTls

    // TODO: Отправить уведомление пользователю о приостановке

    await this.domainsRepo.save(domain);
  }

  /**
   * Получить статистику доменов
   */
  async getDomainsStatistics(): Promise<{
    total: number;
    active: number;
    pending: number;
    issues: number;
    sslExpiringSoon: number;
  }> {
    const [total, active, pending, issues, sslExpiringSoon] = await Promise.all(
      [
        this.domainsRepo.count(),
        this.domainsRepo.count({ where: { status: DomainStatus.ACTIVE } }),
        this.domainsRepo.count({
          where: {
            status: In([
              DomainStatus.PENDING,
              DomainStatus.AWAITING_DNS,
              DomainStatus.AWAITING_VERIFICATION,
            ]),
          },
        }),
        this.domainsRepo.count({
          where: {
            status: In([
              DomainStatus.DNS_INVALID,
              DomainStatus.SSL_ERROR,
              DomainStatus.SUSPENDED,
            ]),
          },
        }),
        this.domainsRepo.count({
          where: { status: DomainStatus.SSL_EXPIRING },
        }),
      ]
    );

    return {
      total,
      active,
      pending,
      issues,
      sslExpiringSoon,
    };
  }
}
