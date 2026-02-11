import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Admin } from "./admin.entity";

export enum AdminActionType {
  // Авторизация
  LOGIN = "login",
  LOGOUT = "logout",
  LOGIN_FAILED = "login_failed",
  PASSWORD_CHANGED = "password_changed",
  TWO_FACTOR_ENABLED = "two_factor_enabled",
  TWO_FACTOR_DISABLED = "two_factor_disabled",

  // Пользователи
  USER_VIEW = "user_view",
  USER_LIST = "user_list",
  USER_UPDATE = "user_update",
  USER_DELETE = "user_delete",
  USER_BLOCK = "user_block",
  USER_UNBLOCK = "user_unblock",

  // Боты
  BOT_VIEW = "bot_view",
  BOT_LIST = "bot_list",
  BOT_UPDATE = "bot_update",
  BOT_DELETE = "bot_delete",
  BOT_FLOW_UPDATE = "bot_flow_update",

  // Магазины
  SHOP_VIEW = "shop_view",
  SHOP_LIST = "shop_list",
  SHOP_UPDATE = "shop_update",
  SHOP_DELETE = "shop_delete",

  // Заказы
  ORDER_VIEW = "order_view",
  ORDER_LIST = "order_list",
  ORDER_UPDATE = "order_update",
  ORDER_CANCEL = "order_cancel",

  // Продукты
  PRODUCT_VIEW = "product_view",
  PRODUCT_LIST = "product_list",
  PRODUCT_UPDATE = "product_update",
  PRODUCT_DELETE = "product_delete",

  // Лиды
  LEAD_VIEW = "lead_view",
  LEAD_LIST = "lead_list",
  LEAD_UPDATE = "lead_update",
  LEAD_DELETE = "lead_delete",

  // Сообщения
  MESSAGE_VIEW = "message_view",
  MESSAGE_LIST = "message_list",

  // Подписки
  SUBSCRIPTION_VIEW = "subscription_view",
  SUBSCRIPTION_LIST = "subscription_list",
  SUBSCRIPTION_UPDATE = "subscription_update",

  // Администраторы
  ADMIN_CREATE = "admin_create",
  ADMIN_UPDATE = "admin_update",
  ADMIN_DELETE = "admin_delete",
  ADMIN_PASSWORD_RESET = "admin_password_reset",

  // Системные
  SYSTEM_SETTINGS_VIEW = "system_settings_view",
  SYSTEM_SETTINGS_UPDATE = "system_settings_update",
  SYSTEM_LOGS_VIEW = "system_logs_view",

  // Бронирования
  BOOKING_VIEW = "booking_view",
  BOOKING_LIST = "booking_list",
  BOOKING_UPDATE = "booking_update",
  BOOKING_CANCEL = "booking_cancel",

  // Кастомные страницы
  CUSTOM_PAGE_VIEW = "custom_page_view",
  CUSTOM_PAGE_LIST = "custom_page_list",
  CUSTOM_PAGE_UPDATE = "custom_page_update",
  CUSTOM_PAGE_DELETE = "custom_page_delete",

  // Шаблоны Flow
  FLOW_TEMPLATE_LIST = "flow_template_list",
  FLOW_TEMPLATE_VIEW = "flow_template_view",
  FLOW_TEMPLATE_CREATE = "flow_template_create",
  FLOW_TEMPLATE_UPDATE = "flow_template_update",
  FLOW_TEMPLATE_DELETE = "flow_template_delete",
  FLOW_TEMPLATE_APPROVE = "flow_template_approve",
  FLOW_TEMPLATE_REJECT = "flow_template_reject",
  FLOW_TEMPLATE_APPROVE_DELETION = "flow_template_approve_deletion",
  FLOW_TEMPLATE_REJECT_DELETION = "flow_template_reject_deletion",
  FLOW_TEMPLATE_PLATFORM_CHOICE = "flow_template_platform_choice",
  FLOW_TEMPLATE_DUPLICATE = "flow_template_duplicate",

  // Категории шаблонов Flow
  FLOW_TEMPLATE_CATEGORY_LIST = "flow_template_category_list",
  FLOW_TEMPLATE_CATEGORY_CREATE = "flow_template_category_create",
  FLOW_TEMPLATE_CATEGORY_UPDATE = "flow_template_category_update",
  FLOW_TEMPLATE_CATEGORY_DELETE = "flow_template_category_delete",
}

export enum AdminActionLevel {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical",
}

@Entity("admin_action_logs")
@Index(["adminId", "createdAt"])
@Index(["actionType", "createdAt"])
@Index(["entityType", "entityId"])
export class AdminActionLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  adminId: string;

  @ManyToOne(() => Admin, (admin) => admin.actionLogs, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "adminId" })
  admin: Admin;

  @Column({
    type: "enum",
    enum: AdminActionType,
  })
  actionType: AdminActionType;

  @Column({
    type: "enum",
    enum: AdminActionLevel,
    default: AdminActionLevel.INFO,
  })
  level: AdminActionLevel;

  @Column({ type: "text" })
  description: string;

  // Информация о затронутой сущности
  @Column({ nullable: true })
  entityType: string; // 'user', 'bot', 'shop', etc.

  @Column({ nullable: true })
  entityId: string;

  // Данные до и после изменения (для аудита)
  @Column({ type: "jsonb", nullable: true })
  previousData: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  newData: Record<string, any>;

  // Дополнительные метаданные
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  // IP адрес и User-Agent
  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  // URL запроса
  @Column({ nullable: true })
  requestUrl: string;

  @Column({ nullable: true })
  requestMethod: string;

  @CreateDateColumn()
  createdAt: Date;
}

