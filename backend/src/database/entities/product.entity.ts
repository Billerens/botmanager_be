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
import { Shop } from "./shop.entity";

/** Вариация товара: + к базе, − от базы или фиксированная (=) цена */
export interface ProductVariation {
  id: string;
  label: string;
  /** 'relative' — база + priceModifier; 'relative_negative' — база − priceModifier; 'fixed' — цена = priceModifier */
  priceType: "relative" | "relative_negative" | "fixed";
  /** Для relative — добавка; для relative_negative — вычитание; для fixed — итоговая цена */
  priceModifier: number;
  /** Активна ли вариация (неактивные не показываются и не добавляются в корзину) */
  isActive?: boolean;
}

/** Скидка на товар: процент или фиксированная сумма */
export interface ProductDiscount {
  type: "percent" | "fixed";
  value: number;
}

/**
 * Цена после применения скидки товара.
 * percent: price * (1 - value/100); fixed: max(0, price - value).
 */
export function applyProductDiscount(
  price: number,
  discount: ProductDiscount | null | undefined
): number {
  if (!discount || discount.value <= 0) return Number(price);
  const p = Number(price);
  if (discount.type === "percent") {
    const v = Math.min(100, Math.max(0, Number(discount.value)));
    return Math.max(0, p * (1 - v / 100));
  }
  return Math.max(0, p - Number(discount.value));
}

@Entity("products")
@Index(["shopId"])
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "int", default: 0 })
  stockQuantity: number;

  @Column({ type: "json", nullable: true })
  images: string[]; // Base64 encoded images

  @Column({ type: "json", nullable: true })
  parameters: Record<string, any>; // JSON object with product parameters

  /** Вариации товара: массив { id, label, priceType: 'relative'|'relative_negative'|'fixed', priceModifier } */
  @Column({
    type: "json",
    nullable: true,
    transformer: {
      to(value: ProductVariation[] | null): ProductVariation[] | null {
        return value == null ? null : value;
      },
      from(value: string | ProductVariation[] | null): ProductVariation[] | null {
        if (value == null) return null;
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value) as unknown;
            if (!Array.isArray(parsed)) return null;
            return parsed.filter(
              (item): item is ProductVariation =>
                item != null &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                "id" in item &&
                "label" in item
            );
          } catch {
            return null;
          }
        }
        if (Array.isArray(value)) {
          return value.filter(
            (item): item is ProductVariation =>
              item != null &&
              typeof item === "object" &&
              !Array.isArray(item) &&
              "id" in item &&
              "label" in item
          );
        }
        return null;
      },
    },
  })
  variations: ProductVariation[] | null;

  /** Разрешить добавление в корзину без выбора вариации (базовый вариант по базовой цене) */
  @Column({ type: "boolean", default: true })
  allowBaseOption: boolean;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связь с магазином
  @ManyToOne(() => Shop, (shop) => shop.products, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "shopId" })
  shop: Shop;

  @Column()
  shopId: string;

  // Категория товара (товар может принадлежать только одной категории)
  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "categoryId" })
  category: Category;

  @Column({ nullable: true })
  categoryId: string;

  /** Скидка: { type: 'percent' | 'fixed', value: number } */
  @Column({ type: "json", nullable: true })
  discount: ProductDiscount | null;

  // Методы (валюта задаётся на уровне магазина, в ответах API добавляется отдельно)
  get formattedPrice(): string {
    return String(this.price);
  }

  get isInStock(): boolean {
    return this.stockQuantity > 0;
  }

  get hasImages(): boolean {
    return this.images && this.images.length > 0;
  }

  get hasParameters(): boolean {
    return this.parameters && Object.keys(this.parameters).length > 0;
  }
}
