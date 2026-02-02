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

export enum ShopEntity {
  SHOP_SETTINGS = "shop_settings",
  PRODUCTS = "products",
  CATEGORIES = "categories",
  ORDERS = "orders",
  CARTS = "carts",
  PROMOCODES = "promocodes",
  SHOP_USERS = "shop_users",
}

@Entity("shop_user_permissions")
export class ShopUserPermission {
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

  @Column({
    type: "enum",
    enum: ShopEntity,
  })
  entity: ShopEntity;

  @Column({
    type: "enum",
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column({ default: false })
  granted: boolean;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "grantedByUserId" })
  grantedByUser?: User;
  @Column({ nullable: true })
  grantedByUserId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
