/**
 * Единый экспорт всех entities
 * Используется в data-source.ts и database.module.ts
 * чтобы избежать дублирования и рассинхронизации
 */

export { User } from "./user.entity";
export { Bot } from "./bot.entity";
export { Message } from "./message.entity";
export { Lead } from "./lead.entity";
export { Subscription } from "./subscription.entity";
export { BotFlow } from "./bot-flow.entity";
export { BotFlowNode, NodeType } from "./bot-flow-node.entity";
export {
  ActivityLog,
  ActivityType,
  ActivityLevel,
} from "./activity-log.entity";
export { Product } from "./product.entity";
export { Category } from "./category.entity";
export { Specialist } from "./specialist.entity";
export { Service } from "./service.entity";
export { TimeSlot } from "./time-slot.entity";
export { Booking } from "./booking.entity";
export { Cart } from "./cart.entity";
export { Order } from "./order.entity";
export { ShopPromocode } from "./shop-promocode.entity";
export { UserSession } from "./user-session.entity";
export { BotCustomData } from "./bot-custom-data.entity";
export { CustomPage } from "./custom-page.entity";
export { CustomPageUser } from "./custom-page-user.entity";
export {
  CustomPageUserPermission,
  CustomPageEntity,
} from "./custom-page-user-permission.entity";
export {
  CustomPageInvitation,
  CustomPageInvitationStatus,
} from "./custom-page-invitation.entity";
export { BotUser } from "./bot-user.entity";
export { BotUserPermission } from "./bot-user-permission.entity";
export { BotInvitation } from "./bot-invitation.entity";
export { GroupSession } from "./group-session.entity";
export { PublicUser, PublicUserOwnerType } from "./public-user.entity";
export { Shop } from "./shop.entity";
export { ShopUser } from "./shop-user.entity";
export { ShopUserPermission, ShopEntity } from "./shop-user-permission.entity";
export { ShopInvitation, ShopInvitationStatus } from "./shop-invitation.entity";
export { Admin } from "./admin.entity";
export { AdminActionLog } from "./admin-action-log.entity";
export { CustomDomain } from "./custom-domain.entity";
export { BookingSystem } from "./booking-system.entity";
export { BookingSystemUser } from "./booking-system-user.entity";
export {
  BookingSystemUserPermission,
  BookingEntity,
} from "./booking-system-user-permission.entity";
export {
  BookingSystemInvitation,
  BookingSystemInvitationStatus,
} from "./booking-system-invitation.entity";
export { PaymentConfig, PaymentEntityType } from "./payment-config.entity";
export {
  Payment,
  PaymentStatus,
  PaymentTargetType,
  EntityPaymentStatus,
} from "./payment.entity";
export {
  CustomCollectionSchema,
  CustomDataOwnerType,
  FieldType,
  RelationType,
  DEFAULT_ACCESS_SETTINGS,
  DEFAULT_RLS_RULES,
  type FieldSchema,
  type CollectionSchemaDefinition,
  type CollectionRelation,
  type CollectionAccessSettings,
  type RowLevelSecurityRules,
} from "./custom-collection-schema.entity";
export { CustomData } from "./custom-data.entity";
export { PublicApiKey, generateApiKey } from "./public-api-key.entity";
export { OpenRouterFeaturedModel } from "./openrouter-featured-model.entity";
export { OpenRouterAgentSettings } from "./openrouter-agent-settings.entity";
export { FlowTemplateCategory } from "./flow-template-category.entity";
export {
  FlowTemplate,
  FlowTemplateType,
  FlowTemplateStatus,
} from "./flow-template.entity";
export {
  StylePreset,
  StylePresetTarget,
  StylePresetStatus,
} from "./style-preset.entity";

/**
 * Массив всех entity классов для TypeORM
 * При добавлении новой entity - добавьте её ТОЛЬКО сюда
 */
import { User } from "./user.entity";
import { Bot } from "./bot.entity";
import { Message } from "./message.entity";
import { Lead } from "./lead.entity";
import { Subscription } from "./subscription.entity";
import { BotFlow } from "./bot-flow.entity";
import { BotFlowNode } from "./bot-flow-node.entity";
import { ActivityLog } from "./activity-log.entity";
import { Product } from "./product.entity";
import { Category } from "./category.entity";
import { Specialist } from "./specialist.entity";
import { Service } from "./service.entity";
import { TimeSlot } from "./time-slot.entity";
import { Booking } from "./booking.entity";
import { Cart } from "./cart.entity";
import { Order } from "./order.entity";
import { ShopPromocode } from "./shop-promocode.entity";
import { UserSession } from "./user-session.entity";
import { BotCustomData } from "./bot-custom-data.entity";
import { CustomPage } from "./custom-page.entity";
import { CustomPageUser } from "./custom-page-user.entity";
import { CustomPageUserPermission } from "./custom-page-user-permission.entity";
import { CustomPageInvitation } from "./custom-page-invitation.entity";
import { BotUser } from "./bot-user.entity";
import { BotUserPermission } from "./bot-user-permission.entity";
import { BotInvitation } from "./bot-invitation.entity";
import { GroupSession } from "./group-session.entity";
import { PublicUser } from "./public-user.entity";
import { Shop } from "./shop.entity";
import { ShopUser } from "./shop-user.entity";
import { ShopUserPermission } from "./shop-user-permission.entity";
import { ShopInvitation } from "./shop-invitation.entity";
import { Admin } from "./admin.entity";
import { AdminActionLog } from "./admin-action-log.entity";
import { CustomDomain } from "./custom-domain.entity";
import { BookingSystem } from "./booking-system.entity";
import { BookingSystemUser } from "./booking-system-user.entity";
import { BookingSystemUserPermission } from "./booking-system-user-permission.entity";
import { BookingSystemInvitation } from "./booking-system-invitation.entity";
import { PaymentConfig } from "./payment-config.entity";
import { Payment } from "./payment.entity";
import { CustomCollectionSchema } from "./custom-collection-schema.entity";
import { CustomData } from "./custom-data.entity";
import { PublicApiKey } from "./public-api-key.entity";
import { OpenRouterFeaturedModel } from "./openrouter-featured-model.entity";
import { OpenRouterAgentSettings } from "./openrouter-agent-settings.entity";
import { FlowTemplateCategory } from "./flow-template-category.entity";
import { FlowTemplate } from "./flow-template.entity";
import { StylePreset } from "./style-preset.entity";

export const ALL_ENTITIES = [
  User,
  Bot,
  Message,
  Lead,
  Subscription,
  BotFlow,
  BotFlowNode,
  ActivityLog,
  Product,
  Category,
  Specialist,
  Service,
  TimeSlot,
  Booking,
  Cart,
  Order,
  ShopPromocode,
  UserSession,
  BotCustomData,
  CustomPage,
  CustomPageUser,
  CustomPageUserPermission,
  CustomPageInvitation,
  BotUser,
  BotUserPermission,
  BotInvitation,
  GroupSession,
  PublicUser,
  Shop,
  ShopUser,
  ShopUserPermission,
  ShopInvitation,
  Admin,
  AdminActionLog,
  CustomDomain,
  BookingSystem,
  BookingSystemUser,
  BookingSystemUserPermission,
  BookingSystemInvitation,
  PaymentConfig,
  Payment,
  CustomCollectionSchema,
  CustomData,
  PublicApiKey,
  OpenRouterFeaturedModel,
  OpenRouterAgentSettings,
  FlowTemplateCategory,
  FlowTemplate,
  StylePreset,
];
