import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from "typeorm";
import { Exclude } from "class-transformer";
import * as bcrypt from "bcrypt";
import { AdminActionLog } from "./admin-action-log.entity";

export enum AdminRole {
  SUPERADMIN = "superadmin", // Полный доступ + управление другими админами
  SUPPORT = "support", // Доступ ко всем сущностям для поддержки
  VIEWER = "viewer", // Только просмотр (для аналитики)
}

export enum AdminStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING_PASSWORD_CHANGE = "pending_password_change",
}

@Entity("admins")
export class Admin {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  telegramId: string;

  @Column({ nullable: true })
  telegramUsername: string;

  @Column({
    type: "enum",
    enum: AdminRole,
    default: AdminRole.SUPPORT,
  })
  role: AdminRole;

  @Column({
    type: "enum",
    enum: AdminStatus,
    default: AdminStatus.ACTIVE,
  })
  status: AdminStatus;

  @Column({ default: true })
  isActive: boolean;

  // Ротация паролей
  @Column({ nullable: true })
  passwordChangedAt: Date;

  @Column({ default: 30 })
  passwordRotationDays: number; // Количество дней до обязательной смены пароля

  @Column({ nullable: true })
  passwordExpiresAt: Date;

  // ID телеграм-пользователя, которому отправлять пароль при ротации
  @Column({ nullable: true })
  passwordRecipientTelegramId: string;

  // Для отслеживания последних действий
  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lastLoginIp: string;

  @Column({ nullable: true })
  lastActivityAt: Date;

  // 2FA (обязательна для админов)
  @Column({ default: false })
  isTwoFactorEnabled: boolean;

  @Column({ nullable: true })
  @Exclude()
  twoFactorSecret: string;

  @Column({ nullable: true })
  @Exclude()
  twoFactorBackupCodes: string;

  @Column({ nullable: true })
  twoFactorVerificationCode: string;

  @Column({ nullable: true })
  twoFactorVerificationExpires: Date;

  // Описание/заметки о админе
  @Column({ nullable: true, type: "text" })
  description: string;

  // JSON с дополнительными настройками (например, разрешенные разделы)
  @Column({ type: "jsonb", nullable: true })
  permissions: Record<string, boolean>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @OneToMany(() => AdminActionLog, (log) => log.admin)
  actionLogs: AdminActionLog[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith("$2b$")) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  @BeforeInsert()
  setPasswordExpiration() {
    this.passwordChangedAt = new Date();
    this.passwordExpiresAt = new Date(
      Date.now() + this.passwordRotationDays * 24 * 60 * 60 * 1000
    );
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  get fullName(): string {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
  }

  get isPasswordExpired(): boolean {
    if (!this.passwordExpiresAt) return false;
    return new Date() > this.passwordExpiresAt;
  }

  get daysUntilPasswordExpires(): number {
    if (!this.passwordExpiresAt) return this.passwordRotationDays;
    const diff = this.passwordExpiresAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }
}

