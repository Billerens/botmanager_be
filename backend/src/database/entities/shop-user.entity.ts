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

@Entity("shop_users")
export class ShopUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Shop, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shopId" })
  shop: Shop;
  @Column()
  shopId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
  @Column()
  userId: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ type: "jsonb", nullable: true })
  permissions: Record<ShopEntity, PermissionAction[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
