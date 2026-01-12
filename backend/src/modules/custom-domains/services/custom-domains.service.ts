import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository, In } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { CustomDomain } from "../../../database/entities/custom-domain.entity";
import { User } from "../../../database/entities/user.entity";
import {
  DomainStatus,
  DomainTargetType,
  VerificationMethod,
} from "../enums/domain-status.enum";
import { DnsValidatorService } from "./dns-validator.service";
import { CaddyService } from "./caddy.service";
import {
  CreateDomainDto,
  DomainResponseDto,
  DnsRecordInstruction,
  VerificationInstruction,
} from "../dto/custom-domain.dto";

@Injectable()
export class CustomDomainsService {
  private readonly logger = new Logger(CustomDomainsService.name);

  /** Минимальный интервал между проверками (5 минут) */
  private readonly MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

  /** Увеличенный интервал после множества неудач (30 минут) */
  private readonly EXTENDED_CHECK_INTERVAL_MS = 30 * 60 * 1000;

  /** Максимум последовательных неудач до увеличения интервала */
  private readonly MAX_FAILURES_BEFORE_SLOWDOWN = 3;

  /** Ожидаемый IP-адрес для A-записи кастомных доменов */
  private readonly expectedIp: string;

  constructor(
    @InjectRepository(CustomDomain)
    private readonly domainsRepo: Repository<CustomDomain>,
    private readonly dnsValidator: DnsValidatorService,
    private readonly caddyService: CaddyService,
    private readonly configService: ConfigService
  ) {
    // IP-адрес фронтенд-сервера, на который должны указывать кастомные домены
    this.expectedIp = this.configService.get<string>("FRONTEND_IP") || "";
  }

  /**
   * Получить все домены пользователя
   */
  async getUserDomains(userId: string): Promise<DomainResponseDto[]> {
    const domains = await this.domainsRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    return domains.map((domain) => this.buildResponse(domain));
  }

  /**
   * Получить домен по ID
   */
  async getDomainById(id: string, userId: string): Promise<DomainResponseDto> {
    const domain = await this.findUserDomain(id, userId);
    return this.buildResponse(domain);
  }

  /**
   * Создать новый кастомный домен
   */
  async createDomain(
    dto: CreateDomainDto,
    user: User
  ): Promise<DomainResponseDto> {
    const normalizedDomain = dto.domain.toLowerCase().trim();

    // Проверяем, не добавлен ли уже этот домен
    const existing = await this.domainsRepo.findOne({
      where: { domain: normalizedDomain },
    });

    if (existing) {
      throw new ConflictException("Этот домен уже добавлен в систему");
    }

    // Валидируем, что указан правильный targetId
    this.validateTargetId(dto);

    // Генерируем токен верификации
    const verificationToken = uuidv4();

    const domain = this.domainsRepo.create({
      domain: normalizedDomain,
      targetType: dto.targetType,
      shopId: dto.shopId,
      bookingId: dto.bookingId,
      customPageId: dto.customPageId,
      user,
      userId: user.id,
      status: DomainStatus.AWAITING_DNS,
      verificationToken,
      expectedIp: this.expectedIp,
    });

    await this.domainsRepo.save(domain);

    this.logger.log(
      `Created custom domain ${normalizedDomain} for user ${user.id}`
    );

    return this.buildResponse(domain);
  }

  /**
   * Запросить проверку DNS
   */
  async requestDnsCheck(
    domainId: string,
    userId: string
  ): Promise<DomainResponseDto> {
    const domain = await this.findUserDomain(domainId, userId);

    // Проверяем rate limit
    this.checkRateLimit(domain);

    // Обновляем время следующей разрешённой проверки
    domain.nextAllowedCheck = new Date(Date.now() + this.MIN_CHECK_INTERVAL_MS);
    domain.dnsCheckAttempts++;

    // Проверяем DNS
    const dnsResult = await this.dnsValidator.validateDns(domain.domain);

    // Обновляем результат проверки
    domain.lastDnsCheck = {
      timestamp: new Date(),
      success: dnsResult.isValid,
      recordType: dnsResult.recordType,
      records: dnsResult.records,
      error: dnsResult.errors[0]?.message,
    };

    if (dnsResult.isValid) {
      // DNS настроен правильно
      domain.status = DomainStatus.AWAITING_VERIFICATION;
      domain.consecutiveFailures = 0;
      domain.errors = [];

      this.logger.log(`DNS validated for ${domain.domain}`);
    } else {
      // DNS не настроен
      domain.status = DomainStatus.DNS_INVALID;
      domain.consecutiveFailures++;

      // Сохраняем ошибки
      domain.errors = dnsResult.errors.map((e) => ({
        code: e.code,
        message: e.message,
        timestamp: new Date(),
        resolved: false,
      }));

      // Увеличиваем интервал при множестве неудач
      if (domain.consecutiveFailures >= this.MAX_FAILURES_BEFORE_SLOWDOWN) {
        domain.nextAllowedCheck = new Date(
          Date.now() + this.EXTENDED_CHECK_INTERVAL_MS
        );

        domain.warnings = [
          {
            code: "TOO_MANY_FAILURES",
            message:
              "Слишком много неудачных попыток. Проверьте настройки DNS и повторите через 30 минут.",
            timestamp: new Date(),
          },
        ];
      }
    }

    await this.domainsRepo.save(domain);

    return this.buildResponse(domain);
  }

  /**
   * Запросить верификацию владения доменом
   */
  async requestOwnershipVerification(
    domainId: string,
    userId: string
  ): Promise<DomainResponseDto> {
    const domain = await this.findUserDomain(domainId, userId);

    // Проверяем статус
    if (domain.status !== DomainStatus.AWAITING_VERIFICATION) {
      throw new BadRequestException(
        "Сначала настройте DNS и дождитесь успешной проверки"
      );
    }

    // Проверяем rate limit
    this.checkRateLimit(domain);

    domain.status = DomainStatus.VALIDATING_OWNERSHIP;
    domain.nextAllowedCheck = new Date(Date.now() + this.MIN_CHECK_INTERVAL_MS);

    // Проверяем владение
    const ownershipResult = await this.dnsValidator.checkOwnership(
      domain.domain,
      domain.verificationToken
    );

    if (ownershipResult.valid) {
      // Верификация успешна
      domain.isVerified = true;
      domain.verificationMethod = ownershipResult.method as VerificationMethod;
      domain.status = DomainStatus.ISSUING_SSL;
      domain.consecutiveFailures = 0;
      domain.errors = [];

      await this.domainsRepo.save(domain);

      this.logger.log(
        `Ownership verified for ${domain.domain} via ${ownershipResult.method}`
      );

      // Активируем домен (добавляем в Caddy)
      await this.activateDomain(domain);
    } else {
      // Верификация не прошла
      domain.status = DomainStatus.AWAITING_VERIFICATION;
      domain.consecutiveFailures++;

      domain.errors = (ownershipResult.errors || []).map((e) => ({
        code: e.code,
        message: e.message,
        timestamp: new Date(),
        resolved: false,
      }));

      await this.domainsRepo.save(domain);
    }

    return this.buildResponse(domain);
  }

  /**
   * Активировать домен (добавить в Caddy)
   */
  async activateDomain(domain: CustomDomain): Promise<void> {
    try {
      // Добавляем маршрут в Caddy
      const success = await this.caddyService.addRoute({
        domain: domain.domain,
        targetType: domain.targetType,
        targetId: domain.shopId || domain.bookingId || domain.customPageId,
      });

      if (!success) {
        throw new Error("Failed to add route to Caddy");
      }

      // Ждём получения сертификата
      await this.waitForSsl(domain);

      // Получаем информацию о сертификате
      const sslInfo = await this.dnsValidator.getSslCertificateInfo(
        domain.domain
      );

      if (sslInfo) {
        domain.sslIssuedAt = sslInfo.issuedAt;
        domain.sslExpiresAt = sslInfo.expiresAt;
        domain.sslIssuer = sslInfo.issuer;
        domain.lastSslCheck = {
          timestamp: new Date(),
          success: true,
          daysUntilExpiry: sslInfo.daysUntilExpiry,
        };
      }

      domain.status = DomainStatus.ACTIVE;
      domain.errors = [];

      await this.domainsRepo.save(domain);

      this.logger.log(`Domain ${domain.domain} activated successfully`);
    } catch (error) {
      this.logger.error(`Failed to activate domain ${domain.domain}`, error);

      domain.status = DomainStatus.SSL_ERROR;
      domain.errors.push({
        code: "SSL_ISSUANCE_FAILED",
        message: `Не удалось получить SSL: ${error.message}`,
        timestamp: new Date(),
        resolved: false,
      });

      await this.domainsRepo.save(domain);
    }
  }

  /**
   * Удалить домен
   */
  async deleteDomain(domainId: string, userId: string): Promise<void> {
    const domain = await this.findUserDomain(domainId, userId);

    // Удаляем маршрут из Caddy
    if (domain.status === DomainStatus.ACTIVE) {
      await this.caddyService.removeRoute(domain.domain);
    }

    await this.domainsRepo.remove(domain);

    this.logger.log(`Deleted domain ${domain.domain}`);
  }

  /**
   * Повторно активировать приостановленный домен
   */
  async reactivateDomain(
    domainId: string,
    userId: string
  ): Promise<DomainResponseDto> {
    const domain = await this.findUserDomain(domainId, userId);

    if (domain.status !== DomainStatus.SUSPENDED) {
      throw new BadRequestException("Домен не приостановлен");
    }

    // Сбрасываем статус и начинаем сначала
    domain.status = DomainStatus.AWAITING_DNS;
    domain.suspendedAt = null;
    domain.suspendReason = null;
    domain.consecutiveFailures = 0;
    domain.errors = [];
    domain.warnings = [];
    domain.nextAllowedCheck = null;

    await this.domainsRepo.save(domain);

    return this.buildResponse(domain);
  }

  /**
   * Получить активные домены для мониторинга
   */
  async getActiveDomainsForMonitoring(): Promise<CustomDomain[]> {
    return this.domainsRepo.find({
      where: {
        status: In([DomainStatus.ACTIVE, DomainStatus.SSL_EXPIRING]),
      },
      relations: ["user"],
    });
  }

  /**
   * Проверить, разрешён ли домен для выпуска TLS сертификата
   * Используется Caddy on-demand TLS
   */
  async isDomainAllowedForTls(domain: string): Promise<boolean> {
    if (!domain) return false;

    const normalizedDomain = domain.toLowerCase().trim();

    // Ищем домен в базе
    const customDomain = await this.domainsRepo.findOne({
      where: { domain: normalizedDomain },
    });

    if (!customDomain) {
      this.logger.warn(
        `Domain ${normalizedDomain} not found for TLS verification`
      );
      return false;
    }

    // Разрешаем только для доменов со статусами, которые должны получить сертификат
    const allowedStatuses = [
      DomainStatus.ISSUING_SSL,
      DomainStatus.ACTIVE,
      DomainStatus.SSL_EXPIRING,
      DomainStatus.SSL_ERROR, // Пытаемся переполучить сертификат
    ];

    if (!allowedStatuses.includes(customDomain.status)) {
      this.logger.warn(
        `Domain ${normalizedDomain} has status ${customDomain.status}, TLS not allowed`
      );
      return false;
    }

    // Проверяем верификацию
    if (!customDomain.isVerified) {
      this.logger.warn(
        `Domain ${normalizedDomain} is not verified, TLS not allowed`
      );
      return false;
    }

    this.logger.log(`Domain ${normalizedDomain} allowed for TLS`);
    return true;
  }

  // ===========================================================================
  // ПРИВАТНЫЕ МЕТОДЫ
  // ===========================================================================

  private async findUserDomain(
    id: string,
    userId: string
  ): Promise<CustomDomain> {
    const domain = await this.domainsRepo.findOne({
      where: { id, userId },
    });

    if (!domain) {
      throw new NotFoundException("Домен не найден");
    }

    return domain;
  }

  private checkRateLimit(domain: CustomDomain): void {
    if (domain.nextAllowedCheck && domain.nextAllowedCheck > new Date()) {
      const waitSeconds = Math.ceil(
        (domain.nextAllowedCheck.getTime() - Date.now()) / 1000
      );
      throw new BadRequestException(
        `Подождите ${waitSeconds} секунд перед следующей проверкой`
      );
    }
  }

  private validateTargetId(dto: CreateDomainDto): void {
    switch (dto.targetType) {
      case DomainTargetType.SHOP:
        if (!dto.shopId) {
          throw new BadRequestException("shopId обязателен для типа shop");
        }
        break;
      case DomainTargetType.BOOKING:
        if (!dto.bookingId) {
          throw new BadRequestException(
            "bookingId обязателен для типа booking"
          );
        }
        break;
      case DomainTargetType.CUSTOM_PAGE:
        if (!dto.customPageId) {
          throw new BadRequestException(
            "customPageId обязателен для типа custom_page"
          );
        }
        break;
    }
  }

  private async waitForSsl(
    domain: CustomDomain,
    maxWaitMs = 60000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const sslInfo = await this.dnsValidator.getSslCertificateInfo(
        domain.domain
      );

      if (sslInfo && sslInfo.isValid) {
        return;
      }

      // Ждём 5 секунд перед следующей проверкой
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Если не дождались, всё равно продолжаем (Caddy получит сертификат позже)
    this.logger.warn(
      `SSL not ready for ${domain.domain} after ${maxWaitMs}ms, continuing...`
    );
  }

  private buildResponse(domain: CustomDomain): DomainResponseDto {
    return {
      id: domain.id,
      domain: domain.domain,
      status: domain.status,
      targetType: domain.targetType,
      shopId: domain.shopId,
      bookingId: domain.bookingId,
      customPageId: domain.customPageId,

      dns: {
        isConfigured: domain.lastDnsCheck?.success ?? false,
        lastCheck: domain.lastDnsCheck?.timestamp,
        records: domain.lastDnsCheck?.records ?? [],
        expectedIp: domain.expectedIp,
        instructions: this.getDnsInstructions(domain),
      },

      verification: {
        isVerified: domain.isVerified,
        token: domain.verificationToken,
        method: domain.verificationMethod,
        instructions: this.getVerificationInstructions(domain),
      },

      ssl: domain.sslExpiresAt
        ? {
            issuedAt: domain.sslIssuedAt,
            expiresAt: domain.sslExpiresAt,
            issuer: domain.sslIssuer,
            daysUntilExpiry: domain.sslDaysUntilExpiry,
            status: this.getSslStatus(domain),
          }
        : undefined,

      errors: domain.errors
        .filter((e) => !e.resolved)
        .map((e) => ({
          code: e.code,
          message: e.message,
          timestamp: e.timestamp,
        })),

      warnings: domain.warnings.map((w) => ({
        code: w.code,
        message: w.message,
        timestamp: w.timestamp,
      })),

      canCheck: domain.canCheck,
      nextAllowedCheck: domain.nextAllowedCheck,
      checkAttempts: domain.dnsCheckAttempts,

      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }

  private getDnsInstructions(domain: CustomDomain): DnsRecordInstruction[] {
    return [
      {
        step: 1,
        title: "Добавьте A запись",
        description:
          "Войдите в панель управления DNS вашего домена и добавьте A-запись, указывающую на наш сервер:",
        record: {
          type: "A",
          name: "@",
          value: domain.expectedIp,
          ttl: 3600,
        },
        tips: [
          "Используйте '@' для корневого домена или имя поддомена (например, 'shop')",
          "Если используете Cloudflare, можно оставить проксирование включенным",
          "Изменения DNS обычно применяются за 5-30 минут, но могут занять до 48 часов",
          "После настройки DNS нажмите кнопку 'Проверить DNS' для активации домена",
        ],
      },
    ];
  }

  private getVerificationInstructions(
    domain: CustomDomain
  ): VerificationInstruction[] {
    return [
      {
        method: "dns_txt",
        title: "Способ 1: TXT запись (рекомендуется)",
        description: "Добавьте TXT запись для подтверждения владения доменом:",
        record: {
          type: "TXT",
          name: `_botmanager-verify.${domain.domain}`,
          value: domain.verificationToken,
          ttl: 3600,
        },
      },
      {
        method: "http_file",
        title: "Способ 2: HTTP файл (альтернатива)",
        description: "Создайте файл по указанному пути с токеном внутри:",
        file: {
          path: `https://${domain.domain}/.well-known/botmanager-verify.txt`,
          content: domain.verificationToken,
        },
      },
    ];
  }

  private getSslStatus(
    domain: CustomDomain
  ): "valid" | "expiring_soon" | "expired" {
    if (!domain.sslExpiresAt) return "expired";
    if (domain.isSslExpired) return "expired";
    if (domain.sslDaysUntilExpiry <= 14) return "expiring_soon";
    return "valid";
  }

  private extractSubdomain(domain: string): string | null {
    const parts = domain.split(".");
    if (parts.length > 2) {
      return parts.slice(0, -2).join(".");
    }
    return null;
  }
}
