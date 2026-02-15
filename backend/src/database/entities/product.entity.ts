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

/** Вариация товара: относительная (+N к базе) или фиксированная (=N) цена */
export interface ProductVariation {
  id: string;
  label: string;
  /** 'relative' — цена = база + priceModifier; 'fixed' — цена = priceModifier */
  priceType: "relative" | "fixed";
  /** Для relative — добавка к базе; для fixed — итоговая цена */
  priceModifier: number;
  /** Активна ли вариация (неактивные не показываются и не добавляются в корзину) */
  isActive?: boolean;
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

  @Column({ length: 3, default: "RUB" })
  currency: string;

  @Column({ type: "int", default: 0 })
  stockQuantity: number;

  @Column({ type: "json", nullable: true })
  images: string[]; // Base64 encoded images

  @Column({ type: "json", nullable: true })
  parameters: Record<string, any>; // JSON object with product parameters

  /** Вариации товара: массив { id, label, priceType: 'relative'|'fixed', priceModifier } */
  @Column({ type: "json", nullable: true })
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

  // Методы
  get formattedPrice(): string {
    return `${this.price} ${this.currency}`;
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
