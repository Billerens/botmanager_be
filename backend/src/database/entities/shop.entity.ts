import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Bot } from "./bot.entity";
import { Product } from "./product.entity";
import { Category } from "./category.entity";
import { Order } from "./order.entity";
import { Cart } from "./cart.entity";
import { ShopPromocode } from "./shop-promocode.entity";
import { SubdomainStatus } from "../../modules/custom-domains/enums/domain-status.enum";

/**
 * Сущность Shop - независимый магазин
 *
 * Магазин может существовать независимо от бота и опционально
 * быть привязан к одному боту (связь 1:1).
 */
@Entity("shops")
export class Shop {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string; // Название магазина в системе управления

  // Уникальный slug для публичных субдоменов: {slug}.shops.botmanagertest.online
  @Column({ nullable: true, unique: true })
  slug?: string;

  // ============================================================================
  // СТАТУС СУБДОМЕНА ПЛАТФОРМЫ
  // ============================================================================

  /**
   * Статус субдомена платформы
   * null если slug не установлен
   */
  @Column({
    type: "enum",
    enum: SubdomainStatus,
    nullable: true,
  })
  subdomainStatus?: SubdomainStatus;

  /**
   * Сообщение об ошибке субдомена (если есть)
   */
  @Column({ nullable: true })
  subdomainError?: string;

  /**
   * Дата активации субдомена
   */
  @Column({ nullable: true })
  subdomainActivatedAt?: Date;

  /**
   * Полный URL субдомена (кэшированный для быстрого доступа)
   * Например: "myshop.shops.botmanagertest.online"
   */
  @Column({ nullable: true })
  subdomainUrl?: string;

  // Владелец магазина
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
  owner: User;

  @Column()
  ownerId: string;

  // Опциональная связь с ботом (1:1, nullable)
  // При удалении бота связь обнуляется, магазин остается
  @OneToOne(() => Bot, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "botId" })
  bot?: Bot;

  @Column({ nullable: true, unique: true })
  botId?: string;

  // Настройки внешнего вида магазина
  @Column({ nullable: true })
  logoUrl?: string;

  @Column({ nullable: true })
  title?: string; // Заголовок магазина (отображается пользователям)

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  customStyles?: string; // Кастомные CSS стили

  // Типы кнопок магазина (command, menu_button, etc.)
  @Column({ type: "json", nullable: true })
  buttonTypes?: string[];

  // Настройки для разных типов кнопок
  @Column({ type: "json", nullable: true })
  buttonSettings?: Record<string, any>;

  // Конфигурация макета страницы магазина (многостраничная структура)
  @Column({ type: "json", nullable: true })
  layoutConfig?: Record<string, any>;

  // Настройки браузерного доступа
  @Column({ default: false })
  browserAccessEnabled: boolean;

  // Требовать верификацию email для браузерного доступа
  @Column({ default: false })
  browserAccessRequireEmailVerification: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи с зависимыми сущностями
  @OneToMany(() => Product, (product) => product.shop)
  products: Product[];

  @OneToMany(() => Category, (category) => category.shop)
  categories: Category[];

  @OneToMany(() => Order, (order) => order.shop)
  orders: Order[];

  @OneToMany(() => Cart, (cart) => cart.shop)
  carts: Cart[];

  @OneToMany(() => ShopPromocode, (promocode) => promocode.shop)
  promocodes: ShopPromocode[];

  // Вычисляемые свойства
  get url(): string {
    const frontendUrl =
      process.env.FRONTEND_URL || "https://botmanagertest.online";
    return `${frontendUrl}/shop/${this.id}`;
  }

  /**
   * Публичный URL магазина
   * Возвращает субдомен если активен, иначе стандартный URL
   */
  get publicUrl(): string {
    if (this.subdomainStatus === SubdomainStatus.ACTIVE && this.subdomainUrl) {
      return `https://${this.subdomainUrl}`;
    }
    return this.url;
  }

  get isActive(): boolean {
    // Магазин активен если у него есть хотя бы название или title
    return !!(this.name || this.title);
  }

  get hasBot(): boolean {
    return !!this.botId;
  }

  get displayName(): string {
    return this.title || this.name;
  }

  /**
   * Проверяет, активен ли субдомен
   */
  get hasActiveSubdomain(): boolean {
    return (
      !!this.slug &&
      this.subdomainStatus === SubdomainStatus.ACTIVE &&
      !!this.subdomainUrl
    );
  }

  /**
   * Проверяет, находится ли субдомен в процессе активации
   */
  get isSubdomainPending(): boolean {
    return (
      !!this.slug &&
      (this.subdomainStatus === SubdomainStatus.PENDING ||
        this.subdomainStatus === SubdomainStatus.DNS_CREATING ||
        this.subdomainStatus === SubdomainStatus.ACTIVATING)
    );
  }
}
