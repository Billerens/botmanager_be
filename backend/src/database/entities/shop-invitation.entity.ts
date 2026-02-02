import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Shop } from "./shop.entity";
import { PermissionAction } from "./bot-user-permission.entity";
import { ShopEntity } from "./shop-user-permission.entity";

export enum ShopInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

@Entity("shop_invitations")
export class ShopInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Shop, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shopId" })
  shop: Shop;
  @Column()
  shopId: string;

  @Column()
  invitedTelegramId: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "invitedUserId" })
  invitedUser?: User;
  @Column({ nullable: true })
  invitedUserId?: string;

  @Column({
    type: "enum",
    enum: ShopInvitationStatus,
    default: ShopInvitationStatus.PENDING,
  })
  status: ShopInvitationStatus;

  @Column({ type: "jsonb" })
  permissions: Record<ShopEntity, PermissionAction[]>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invitedByUserId" })
  invitedByUser: User;
  @Column()
  invitedByUserId: string;

  @Column({ nullable: true })
  invitationToken: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
