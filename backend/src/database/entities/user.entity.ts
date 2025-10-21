import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { Exclude } from "class-transformer";
import * as bcrypt from "bcrypt";
import { Bot } from "./bot.entity";
import { Lead } from "./lead.entity";
import { Subscription } from "./subscription.entity";

export enum UserRole {
  OWNER = "owner",
  ADMIN = "admin",
  MANAGER = "manager",
}

export enum SubscriptionPlan {
  START = "start",
  BUSINESS = "business",
  PRO = "pro",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  telegramId: string;

  @Column({ nullable: true })
  telegramUsername: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.OWNER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ nullable: true })
  emailVerificationCode: string;

  @Column({ nullable: true })
  emailVerificationExpires: Date;

  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ nullable: true })
  passwordResetExpires: Date;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @OneToMany(() => Bot, (bot) => bot.owner)
  bots: Bot[];

  @OneToMany(() => Lead, (lead) => lead.user)
  leads: Lead[];

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions: Subscription[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith("$2b$")) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  get fullName(): string {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
  }
}
