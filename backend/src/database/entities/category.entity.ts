import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { Product } from "./product.entity";
import { Shop } from "./shop.entity";

@Entity("categories")
@Index(["shopId"])
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

  // Связь с магазином
  @ManyToOne(() => Shop, (shop) => shop.categories, { 
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "shopId" })
  shop: Shop;

  @Column()
  shopId: string;

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
