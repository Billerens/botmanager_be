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
import { Exclude } from "class-transformer";
import { Shop } from "./shop.entity";

@Entity("public_users")
@Index(["email", "shopId"], { unique: true }) // Email уникален только в рамках одного магазина
@Index(["shopId"])
@Index(["shopId", "telegramId"]) // Для поиска по telegramId в рамках магазина
export class PublicUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  // Связь с магазином
  @ManyToOne(() => Shop, (shop) => shop.publicUsers, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "shopId" })
  shop: Shop;

  @Column()
  shopId: string;

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
