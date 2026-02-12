import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Exclude } from "class-transformer";

/**
 * Тип владельца публичного пользователя
 * Определяет контекст, в котором зарегистрирован пользователь
 */
export enum PublicUserOwnerType {
  /** Глобальный пользователь владельца аккаунта */
  USER = "user",
  /** Пользователь конкретного бота */
  BOT = "bot",
  /** Пользователь магазина */
  SHOP = "shop",
  /** Пользователь системы бронирования */
  BOOKING = "booking",
  /** Пользователь кастомной страницы (ownerId = customPageId) */
  CUSTOM_PAGE = "custom_page",
  /** Пользователь цепочки/проекта (ownerId = chainId); один аккаунт на всю цепочку */
  CHAIN = "chain",
}

@Entity("public_users")
@Index(["email", "ownerId", "ownerType"], { unique: true }) // Email уникален в рамках владельца
@Index(["ownerId", "ownerType"])
@Index(["ownerId", "ownerType", "telegramId"]) // Для поиска по telegramId в рамках владельца
export class PublicUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  /**
   * ID владельца (userId, botId или shopId в зависимости от ownerType)
   */
  @Column()
  ownerId: string;

  /**
   * Тип владельца
   */
  @Column({
    type: "enum",
    enum: PublicUserOwnerType,
    default: PublicUserOwnerType.USER,
  })
  ownerType: PublicUserOwnerType;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  telegramId?: string; // Для связывания аккаунтов с Telegram (уникален в рамках бота)

  @Column({ nullable: true })
  telegramUsername?: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationCode?: string;

  @Column({ type: "timestamptz", nullable: true })
  emailVerificationCodeExpires?: Date;

  @Column({ nullable: true })
  passwordResetToken?: string;

  @Column({ type: "timestamptz", nullable: true })
  passwordResetTokenExpires?: Date;

  @Column({ nullable: true })
  refreshToken?: string;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Вычисляемые свойства
  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.email;
  }

  get displayName(): string {
    return this.fullName;
  }

  // Проверка истечения кода верификации
  isVerificationCodeExpired(): boolean {
    if (!this.emailVerificationCodeExpires) return true;
    return new Date() > this.emailVerificationCodeExpires;
  }

  // Проверка истечения токена сброса пароля
  isPasswordResetTokenExpired(): boolean {
    if (!this.passwordResetTokenExpires) return true;
    return new Date() > this.passwordResetTokenExpires;
  }
}
