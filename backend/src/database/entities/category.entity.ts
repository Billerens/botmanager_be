import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  ManyToMany,
} from "typeorm";
import { Bot } from "./bot.entity";
import { Product } from "./product.entity";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number; // Порядок сортировки для отображения

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Иерархическая структура: категория может иметь родительскую категорию
  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "parentId" })
  parent: Category;

  @Column({ nullable: true })
  parentId: string;

  // Подкатегории
  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  // Связь с ботом (категории привязаны к конкретному боту)
  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column()
  botId: string;

  // Товары, которые напрямую принадлежат этой категории
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  // Методы
  get isRoot(): boolean {
    return !this.parentId;
  }

  get hasChildren(): boolean {
    return this.children && this.children.length > 0;
  }
}
