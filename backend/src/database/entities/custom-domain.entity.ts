import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import {
  DomainStatus,
  DomainTargetType,
  VerificationMethod,
} from "../../modules/custom-domains/enums/domain-status.enum";

/**
 * Структура ошибки домена
 */
export interface DomainError {
  code: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

/**
 * Структура предупреждения домена
 */
export interface DomainWarning {
  code: string;
  message: string;
  timestamp: Date;
}

/**
 * Результат последней DNS проверки
 */
export interface DnsCheckResult {
  timestamp: Date;
  success: boolean;
  recordType?: "CNAME" | "A" | null;
  records: string[];
  error?: string;
}

/**
 * Результат последней SSL проверки
 */
export interface SslCheckResult {
  timestamp: Date;
  success: boolean;
  daysUntilExpiry?: number;
  error?: string;
}

@Entity("custom_domains")
@Index(["userId", "status"])
@Index(["status"])
export class CustomDomain {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * Полное доменное имя (например: shop.example.com)
   */
  @Column({ unique: true })
  @Index()
  domain: string;

  /**
   * Текущий статус домена
   */
  @Column({
    type: "enum",
    enum: DomainStatus,
    default: DomainStatus.PENDING,
  })
  status: DomainStatus;

  /**
   * Тип целевого ресурса
   */
  @Column({
    type: "enum",
    enum: DomainTargetType,
  })
  targetType: DomainTargetType;

  /**
   * ID магазина (если targetType = shop)
   */
  @Column({ nullable: true })
  shopId: string;

  /**
   * ID системы бронирования (если targetType = booking)
   */
  @Column({ nullable: true })
  bookingId: string;

  /**
   * ID кастомной страницы (если targetType = custom_page)
   */
  @Column({ nullable: true })
  customPageId: string;

  // ===========================================================================
  // ВЕРИФИКАЦИЯ
  // ===========================================================================

  /**
   * Токен для верификации владения доменом
   */
  @Column()
  verificationToken: string;

  /**
   * Флаг успешной верификации
   */
  @Column({ default: false })
  isVerified: boolean;

  /**
   * Метод, которым была выполнена верификация
   */
  @Column({
    type: "enum",
    enum: VerificationMethod,
    nullable: true,
  })
  verificationMethod: VerificationMethod;

  // ===========================================================================
  // DNS ИНФОРМАЦИЯ
  // ===========================================================================

  /**
   * Ожидаемое значение CNAME записи
   * Значение устанавливается в CustomDomainsService из конфигурации
   */
  @Column({ default: "proxy.botmanagertest.online" })
  expectedCname: string;

  /**
   * Результат последней DNS проверки
   */
  @Column({ type: "jsonb", nullable: true })
  lastDnsCheck: DnsCheckResult;

  /**
   * Количество попыток проверки DNS
   */
  @Column({ default: 0 })
  dnsCheckAttempts: number;

  // ===========================================================================
  // SSL ИНФОРМАЦИЯ
  // ===========================================================================

  /**
   * Дата выпуска текущего SSL сертификата
   */
  @Column({ nullable: true })
  sslIssuedAt: Date;

  /**
   * Дата истечения SSL сертификата
   */
  @Column({ nullable: true })
  sslExpiresAt: Date;

  /**
   * Издатель сертификата (Let's Encrypt и т.д.)
   */
  @Column({ nullable: true })
  sslIssuer: string;

  /**
   * Результат последней SSL проверки
   */
  @Column({ type: "jsonb", nullable: true })
  lastSslCheck: SslCheckResult;

  // ===========================================================================
  // ОШИБКИ И ПРЕДУПРЕЖДЕНИЯ
  // ===========================================================================

  /**
   * Массив текущих ошибок
   */
  @Column({ type: "jsonb", default: [] })
  errors: DomainError[];

  /**
   * Массив предупреждений
   */
  @Column({ type: "jsonb", default: [] })
  warnings: DomainWarning[];

  // ===========================================================================
  // ЗАЩИТА ОТ СПАМА
  // ===========================================================================

  /**
   * Время, после которого можно делать следующую проверку
   */
  @Column({ nullable: true })
  nextAllowedCheck: Date;

  /**
   * Счётчик последовательных неудачных проверок
   */
  @Column({ default: 0 })
  consecutiveFailures: number;

  // ===========================================================================
  // ПРИОСТАНОВКА
  // ===========================================================================

  /**
   * Дата приостановки домена
   */
  @Column({ nullable: true })
  suspendedAt: Date;

  /**
   * Причина приостановки
   */
  @Column({ nullable: true })
  suspendReason: string;

  // ===========================================================================
  // УВЕДОМЛЕНИЯ
  // ===========================================================================

  /**
   * Массив отправленных уведомлений (для предотвращения дубликатов)
   * Например: ['ssl_warning_14d', 'ssl_warning_7d', 'dns_warning']
   */
  @Column({ type: "jsonb", default: [] })
  notificationsSent: string[];

  // ===========================================================================
  // СВЯЗИ
  // ===========================================================================

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  @Index()
  userId: string;

  // ===========================================================================
  // TIMESTAMPS
  // ===========================================================================

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ===========================================================================
  // ВЫЧИСЛЯЕМЫЕ ПОЛЯ
  // ===========================================================================

  /**
   * Проверяет, можно ли сейчас делать проверку
   */
  get canCheck(): boolean {
    if (!this.nextAllowedCheck) return true;
    return new Date() >= this.nextAllowedCheck;
  }

  /**
   * Возвращает количество дней до истечения SSL
   */
  get sslDaysUntilExpiry(): number | null {
    if (!this.sslExpiresAt) return null;
    const now = new Date();
    const diff = this.sslExpiresAt.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Проверяет, истёк ли SSL сертификат
   */
  get isSslExpired(): boolean {
    if (!this.sslExpiresAt) return false;
    return new Date() > this.sslExpiresAt;
  }
}

