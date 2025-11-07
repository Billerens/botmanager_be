import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";
import { Category } from "./category.entity";

@Entity("products")
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

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Bot, (bot) => bot.products, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column()
  botId: string;

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
