/**
 * Статусы кастомного домена
 *
 * State Machine:
 * PENDING → AWAITING_DNS → DNS_INVALID (loop) или AWAITING_VERIFICATION
 * AWAITING_VERIFICATION → VALIDATING_OWNERSHIP → ISSUING_SSL → ACTIVE
 * ACTIVE → DNS_INVALID / SSL_EXPIRING / SUSPENDED
 */
export enum DomainStatus {
  /** Только что создан, ожидает начала настройки */
  PENDING = "pending",

  /** Ожидаем настройки DNS пользователем */
  AWAITING_DNS = "awaiting_dns",

  /** Проверяем DNS (кратковременный статус) */
  VALIDATING_DNS = "validating_dns",

  /** DNS настроен неправильно */
  DNS_INVALID = "dns_invalid",

  /** DNS OK, ожидаем подтверждения владения */
  AWAITING_VERIFICATION = "awaiting_verification",

  /** Проверяем владение (кратковременный статус) */
  VALIDATING_OWNERSHIP = "validating_ownership",

  /** Выпускаем SSL сертификат */
  ISSUING_SSL = "issuing_ssl",

  /** Всё работает */
  ACTIVE = "active",

  /** Ошибка при выпуске/обновлении SSL */
  SSL_ERROR = "ssl_error",

  /** SSL скоро истечёт (предупреждение) */
  SSL_EXPIRING = "ssl_expiring",

  /** Приостановлен (DNS изменился, слишком много ошибок и т.д.) */
  SUSPENDED = "suspended",
}

/**
 * Тип целевого ресурса для домена
 */
export enum DomainTargetType {
  SHOP = "shop",
  BOOKING = "booking",
  CUSTOM_PAGE = "custom_page",
}

/**
 * Метод верификации владения доменом
 */
export enum VerificationMethod {
  DNS_TXT = "dns_txt",
  HTTP_FILE = "http_file",
}

/**
 * Коды ошибок домена
 */
export enum DomainErrorCode {
  // DNS ошибки
  DNS_NOT_FOUND = "DNS_NOT_FOUND",
  CNAME_WRONG_TARGET = "CNAME_WRONG_TARGET",
  A_RECORD_WRONG_IP = "A_RECORD_WRONG_IP",
  DNS_LOOKUP_FAILED = "DNS_LOOKUP_FAILED",

  // Ошибки верификации
  TXT_NOT_FOUND = "TXT_NOT_FOUND",
  TXT_TOKEN_MISMATCH = "TXT_TOKEN_MISMATCH",
  HTTP_FILE_NOT_ACCESSIBLE = "HTTP_FILE_NOT_ACCESSIBLE",
  HTTP_TOKEN_MISMATCH = "HTTP_TOKEN_MISMATCH",

  // SSL ошибки
  SSL_ISSUANCE_FAILED = "SSL_ISSUANCE_FAILED",
  SSL_RENEWAL_FAILED = "SSL_RENEWAL_FAILED",
  SSL_EXPIRED = "SSL_EXPIRED",

  // Прочие
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  OWNERSHIP_LOST = "OWNERSHIP_LOST",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Коды предупреждений
 */
export enum DomainWarningCode {
  TOO_MANY_FAILURES = "TOO_MANY_FAILURES",
  SSL_EXPIRING_SOON = "SSL_EXPIRING_SOON",
  DNS_PROPAGATION_SLOW = "DNS_PROPAGATION_SLOW",
}

/**
 * Статусы субдомена платформы (для бесплатных субдоменов)
 * Используется для: *.shops.domain, *.booking.domain, *.pages.domain
 *
 * Архитектура (2-шаговый процесс через Timeweb API):
 * 1. Backend создаёт поддомен: POST /domains/{baseDomain}/subdomains/{fqdn}
 * 2. Backend создаёт A-запись: POST /domains/{fqdn}/dns-records
 * 3. Timeweb автоматически выдаёт SSL сертификаты
 * 4. Frontend определяет по hostname что показывать
 *
 * State Machine:
 * PENDING → DNS_CREATING → ACTIVATING → ACTIVE
 *        ↘ ERROR (при ошибке на любом шаге)
 * ACTIVE → REMOVING → null (удалён)
 */
export enum SubdomainStatus {
  /** Ожидает регистрации (начальный статус) */
  PENDING = "pending",

  /**
   * Создаётся поддомен и DNS запись в Timeweb (2-шаговый процесс)
   * Шаг 1: Создание поддомена
   * Шаг 2: Создание A-записи
   */
  DNS_CREATING = "dns_creating",

  /**
   * Поддомен и DNS созданы, ждём:
   * - DNS propagation (обычно 1-5 минут)
   * - SSL сертификат от Timeweb (автоматически)
   */
  ACTIVATING = "activating",

  /** Активен и работает (HTTPS доступен) */
  ACTIVE = "active",

  /**
   * Ошибка регистрации:
   * - Не удалось создать поддомен
   * - Не удалось создать DNS запись
   * - Таймаут активации
   */
  ERROR = "error",

  /**
   * Удаляется (2-шаговый процесс):
   * Шаг 1: Удаление всех DNS записей
   * Шаг 2: Удаление поддомена
   */
  REMOVING = "removing",
}

/**
 * Тип субдомена платформы
 */
export enum SubdomainType {
  SHOP = "shops",
  BOOKING = "booking",
  PAGE = "pages",
}
