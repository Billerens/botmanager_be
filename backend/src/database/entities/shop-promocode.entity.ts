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
import { Category } from "./category.entity";
import { Product } from "./product.entity";
import { Shop } from "./shop.entity";

export enum ShopPromocodeType {
  FIXED = "fixed", // Фиксированная скидка
  PERCENTAGE = "percentage", // Процентная скидка
}

export enum ShopPromocodeApplicableTo {
  CART = "cart", // Применим ко всей корзине
  CATEGORY = "category", // Применим к категории
  PRODUCT = "product", // Применим к продукту
}

export enum ShopPromocodeUsageLimit {
  SINGLE_USE = "single_use", // Одноразовый
  LIMITED = "limited", // Многоразовый с ограничением количества
  UNLIMITED = "unlimited", // Бесконечный
}

@Entity("shop_promocodes")
@Index(["shopId", "code"], { unique: true })
export class ShopPromocode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Связь с магазином
  @Column()
  shopId: string;

  @Column({ length: 100 })
  code: string; // Код промокода

  @Column({
    type: "enum",
    enum: ShopPromocodeType,
    default: ShopPromocodeType.PERCENTAGE,
  })
  type: ShopPromocodeType; // Тип скидки: фиксированная или процентная

  @Column({ type: "decimal", precision: 10, scale: 2 })
  value: number; // Значение скидки (для фиксированной - сумма, для процентной - процент)

  @Column({
    type: "enum",
    enum: ShopPromocodeApplicableTo,
    default: ShopPromocodeApplicableTo.CART,
  })
  applicableTo: ShopPromocodeApplicableTo; // Применим к: корзина, категория, продукт

  @Column({ nullable: true })
  categoryId: string | null; // ID категории, если применим к категории

  @Column({ nullable: true })
  productId: string | null; // ID продукта, если применим к продукту

  @Column({
    type: "enum",
    enum: ShopPromocodeUsageLimit,
    default: ShopPromocodeUsageLimit.UNLIMITED,
  })
  usageLimit: ShopPromocodeUsageLimit; // Тип ограничения использования

  @Column({ type: "int", nullable: true })
  maxUsageCount: number | null; // Максимальное количество использований (для LIMITED)

  @Column({ type: "int", default: 0 })
  currentUsageCount: number; // Текущее количество использований

  @Column({ default: true })
  isActive: boolean; // Активность промокода

  @Column({ type: "timestamptz", nullable: true })
  validFrom: Date | null; // Дата начала действия

  @Column({ type: "timestamptz", nullable: true })
  validUntil: Date | null; // Дата окончания действия

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связь с магазином
  @ManyToOne(() => Shop, (shop) => shop.promocodes, { 
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "shopId" })
  shop: Shop;

  @ManyToOne(() => Category, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "categoryId" })
  category: Category | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product: Product | null;

  // Методы
  get isExpired(): boolean {
    if (!this.validUntil) return false;
    return new Date() > this.validUntil;
  }

  get isNotStarted(): boolean {
    if (!this.validFrom) return false;
    return new Date() < this.validFrom;
  }

  get isAvailable(): boolean {
    if (!this.isActive) return false;
    if (this.isExpired) return false;
    if (this.isNotStarted) return false;
    if (
      this.usageLimit === ShopPromocodeUsageLimit.LIMITED &&
      this.maxUsageCount !== null &&
      this.currentUsageCount >= this.maxUsageCount
    ) {
      return false;
    }
    return true;
  }

  get canBeUsed(): boolean {
    return this.isAvailable;
  }
}
