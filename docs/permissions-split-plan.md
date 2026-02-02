# План: разделение моделей прав (бот / магазин / букинг / custom page)

## Цель

- Оставить у **бота** только права, относящиеся к самому боту (без shop/booking/custom page).
- Ввести **отдельные** модели прав для магазина, букинга и custom page по той же схеме, что и у бота (user + entity + permissions + invitations), без учёта связей между сущностями.

---

## 1. Общая схема (одинаковая для всех четырёх типов)

Для каждой сущности (Bot, Shop, BookingSystem, CustomPage):

| Компонент | Бот (как есть) | Магазин | Букинг | Custom Page |
|-----------|----------------|---------|--------|-------------|
| Связь user–ресурс | `bot_users` | `shop_users` | `booking_system_users` | `custom_page_users` |
| Детальные права | `bot_user_permissions` | `shop_user_permissions` | `booking_system_user_permissions` | `custom_page_user_permissions` |
| Приглашения | `bot_invitations` | `shop_invitations` | `booking_system_invitations` | `custom_page_invitations` |
| Enum сущностей | `BotEntity` (урезанный) | `ShopEntity` | `BookingEntity` | `CustomPageEntity` |
| Действия | `PermissionAction` (read/create/update/delete) — общий для всех | | | |

Логика везде одна: владелец (ownerId) имеет полный доступ; приглашённые — через запись в `*_users` и детальные права в `*_user_permissions`; приглашение создаёт запись в `*_users` и копирует права в `*_user_permissions`.

---

## 2. Бот: что убрать из текущей модели

### 2.1. Удалить из enum `BotEntity`

Удалить (переносятся в Shop / Booking / CustomPage):

- `PRODUCTS`, `CATEGORIES`, `ORDERS`, `CARTS` → магазин
- `SPECIALISTS`, `BOOKINGS`, `BOOKING_SETTINGS` → букинг
- `SHOP_SETTINGS`, `SHOP_PROMOCODES` → магазин
- `CUSTOM_PAGES` → custom page

Оставить в `BotEntity`:

- `BOT_SETTINGS`
- `FLOWS`
- `MESSAGES`
- `LEADS`
- `ANALYTICS`
- `BOT_USERS`
- `CUSTOM_DATA`

### 2.2. Изменения в коде (backend)

- **bot-user-permission.entity.ts** — enum `BotEntity` сократить до перечисленных выше значений.
- **bot-invitation.entity.ts** — тип `permissions` остаётся `Record<BotEntity, PermissionAction[]>` (меньше ключей).
- **bot-notifications.service.ts** — убрать из маппинга названий прав удалённые сущности.
- **Миграция БД**:
  - В PostgreSQL enum изменить (ALTER TYPE … ADD VALUE / нельзя удалить значение из enum без пересоздания типа). Вариант: создать новый enum `bot_user_permissions_entity_enum_v2`, пересоздать колонку, удалить старый тип.
  - Удалить из `bot_user_permissions` строки с `entity` из старого набора (PRODUCTS, CATEGORIES, …).
  - В `bot_invitations` поле `permissions` (jsonb) — при чтении игнорировать лишние ключи; при записи не сохранять удалённые ключи (логика в сервисе/DTO).

### 2.3. Products / Categories / Orders / Cart / Shop promocodes

Сейчас API продуктов под роутом `bots/:botId/products` и guard по `BotEntity.PRODUCTS`. После изменений:

- Роут продуктов перевести на **shops**: например `shops/:shopId/products` (или оставить алиас, но проверка прав — по магазину).
- Guard — **ShopPermissionGuard** + `ShopEntity.PRODUCTS` (см. раздел 3).
- Аналогично: категории, заказы, корзина, промокоды магазина — доступ через права **магазина**, не бота.

Точный список файлов для правок по продуктам/категориям/заказам/корзине/промокодам — в п. 3.4.

---

## 3. Магазин (Shop): новая модель прав

### 3.1. Enum прав магазина

```ts
// shop-user-permission.entity.ts (новый файл или общий permission-types)
export enum ShopEntity {
  SHOP_SETTINGS = "shop_settings",
  PRODUCTS = "products",
  CATEGORIES = "categories",
  ORDERS = "orders",
  CARTS = "carts",
  PROMOCODES = "promocodes",  // shop_promocodes
  SHOP_USERS = "shop_users", // управление приглашёнными
}
```

`PermissionAction` — переиспользовать общий (read, create, update, delete).

### 3.2. Таблицы и сущности

- **shop_users**  
  - Поля: id, shopId, userId, displayName, permissions (jsonb — кэш `Record<ShopEntity, PermissionAction[]>`), createdAt, updatedAt.  
  - Уникальность: (shopId, userId).

- **shop_user_permissions**  
  - Поля: id, shopId, userId, entity (ShopEntity), action (PermissionAction), granted, grantedByUserId, createdAt, updatedAt.  
  - Уникальность: (shopId, userId, entity, action).

- **shop_invitations**  
  - Поля: id, shopId, invitedTelegramId, invitedUserId (nullable), status (pending/accepted/declined/expired), permissions (jsonb), invitedByUserId, invitationToken, expiresAt, createdAt, updatedAt.  
  - Логика как у `bot_invitations`: по токену принять/отклонить, при принятии создать `shop_user` и записи в `shop_user_permissions`.

### 3.3. Сервисы и guard

- **ShopPermissionsService** (по аналогии с BotPermissionsService):  
  - hasAccessToShop(userId, shopId)  
  - hasPermission(userId, shopId, entity, action)  
  - getUserPermissions(userId, shopId)  
  - setPermission / setBulkPermissions  
  - addUserToShop / removeUserFromShop / getShopUsers  

- **ShopInvitationsService**: createInvitation, acceptInvitation, declineInvitation, getShopInvitations, getUserInvitations (по telegramId), cancelInvitation, getInvitationByToken, cleanupExpired.

- **ShopPermissionGuard**: из request достаёт shopId (params/query/body), требует декоратор с (ShopEntity, PermissionAction[]), вызывает ShopPermissionsService.hasPermission. Владелец магазина (shop.ownerId === userId) — полный доступ.

### 3.4. Интеграция в модули

- **Shops**  
  - Владелец: как сейчас по `shop.ownerId`.  
  - Для приглашённых: перед проверкой owner проверять `hasAccessToShop`; если да — дальше проверять конкретное право (например SHOP_SETTINGS для настроек, PRODUCTS для товаров и т.д.) через `hasPermission(..., ShopEntity.*, action)`.

- **Products**  
  - Роут: перевести на `shops/:shopId/products`.  
  - Guard: JwtAuthGuard + ShopPermissionGuard с нужным ShopEntity.PRODUCTS и action.  
  - В ProductsService проверка доступа через ShopPermissionsService или через guard (достаточно guard + shopId в пути).

- **Categories, Orders, Cart, Shop-promocodes**  
  - Аналогично: роуты от shopId, guard по ShopEntity (CATEGORIES, ORDERS, CARTS, PROMOCODES), сервисы проверяют владельца или hasPermission по магазину.

- **API магазина**  
  - Эндпоинты: GET/POST `shops/:shopId/users`, GET/POST invitations, PATCH permissions пользователя и т.д. (по образцу bots/:botId/users и invitations).

### 3.5. Миграция

- Одна миграция: создать enum `shop_user_permissions_entity_enum`, таблицы `shop_users`, `shop_user_permissions`, `shop_invitations`, индексы и FK.

---

## 4. Букинг (BookingSystem): новая модель прав

### 4.1. Enum прав букинга

```ts
export enum BookingEntity {
  BOOKING_SETTINGS = "booking_settings",
  SPECIALISTS = "specialists",
  SERVICES = "services",
  BOOKINGS = "bookings",       // слоты/записи
  BOOKING_SYSTEM_USERS = "booking_system_users",
}
```

### 4.2. Таблицы и сущности

- **booking_system_users** — id, bookingSystemId, userId, displayName, permissions (jsonb), createdAt, updatedAt; UNIQUE(bookingSystemId, userId).
- **booking_system_user_permissions** — id, bookingSystemId, userId, entity (BookingEntity), action, granted, grantedByUserId, createdAt, updatedAt; UNIQUE(bookingSystemId, userId, entity, action).
- **booking_system_invitations** — по образцу bot_invitations (shopId → bookingSystemId).

### 4.3. Сервисы и guard

- **BookingSystemPermissionsService** — hasAccessToBookingSystem, hasPermission, getUserPermissions, setPermission, setBulkPermissions, addUserToBookingSystem, removeUserFromBookingSystem, getBookingSystemUsers.
- **BookingSystemInvitationsService** — create, accept, decline, list, cancel, getByToken, cleanupExpired.
- **BookingSystemPermissionGuard** — по bookingSystemId из params, проверка owner или hasPermission.

### 4.4. Интеграция

- В **booking-systems** и подмодуле **booking** (specialists, services, slots, bookings): доступ по ownerId или через BookingSystemPermissionsService.hasPermission с соответствующим BookingEntity.

### 4.5. Миграция

- Создать enum и три таблицы для букинга.

---

## 5. Custom Page: новая модель прав

### 5.1. Enum прав страницы

Достаточно одного типа сущности с CRUD:

```ts
export enum CustomPageEntity {
  PAGE = "page",  // настройки + контент страницы (read/create/update/delete)
  CUSTOM_PAGE_USERS = "custom_page_users",
}
```

Либо разделить: `PAGE_SETTINGS`, `PAGE_CONTENT`, `CUSTOM_PAGE_USERS` — на усмотрение, можно начать с одного `PAGE`.

### 5.2. Таблицы и сущности

- **custom_page_users** — id, customPageId, userId, displayName, permissions (jsonb), createdAt, updatedAt; UNIQUE(customPageId, userId).
- **custom_page_user_permissions** — id, customPageId, userId, entity (CustomPageEntity), action, granted, grantedByUserId, createdAt, updatedAt.
- **custom_page_invitations** — по образцу bot_invitations (resourceId = customPageId).

### 5.3. Сервисы и guard

- **CustomPagePermissionsService** — hasAccessToCustomPage, hasPermission, getUserPermissions, setPermission, setBulkPermissions, addUserToCustomPage, removeUserFromCustomPage, getCustomPageUsers.
- **CustomPageInvitationsService** — create, accept, decline, list, cancel, getByToken, cleanupExpired.
- **CustomPagePermissionGuard** — по customPageId (или pageId в params), owner или hasPermission.

### 5.4. Интеграция

- **custom-data-ownership.guard.ts**: для кастомной страницы убрать проверку через BotEntity.CUSTOM_PAGES и botId. Вместо неё: если ресурс — custom page, проверять ownerId страницы или CustomPagePermissionsService.hasPermission(userId, pageId, CustomPageEntity.PAGE, action).
- Роуты custom pages: доступ по ownerId или по правам приглашённого к этой странице.

### 5.5. Миграция

- Создать enum и три таблицы для custom page.

---

## 6. Общие моменты

### 6.1. PermissionAction

Оставить один общий enum в одном месте (например в `bot-user-permission.entity.ts` или вынести в `common/permission-action.enum.ts`) и импортировать в bot/shop/booking/custom-page сущности и сервисы.

### 6.2. Уведомления (Telegram)

- **BotNotificationsService** — только для приглашений в бота; маппинг названий прав — только BotEntity.
- Добавить (или обобщить): **ShopInvitationNotification**, **BookingSystemInvitationNotification**, **CustomPageInvitationNotification** — по тому же сценарию, что и отправка приглашения в бота (текст, ссылка на принятие и т.д.), если у вас уже есть канал отправки в Telegram по userId/telegramId.

### 6.3. Порядок внедрения (рекомендуемый)

1. **Общий PermissionAction** — вынести в общий файл, если ещё не вынесен.  
2. **Бот**: урезать BotEntity, миграция (очистка старых прав + enum), обновить guards/сервисы/нотификации.  
3. **Магазин**: сущности, миграция, ShopPermissionsService + ShopInvitationsService, ShopPermissionGuard; перевести products/categories/orders/cart/promocodes на shops/:shopId и ShopPermissionGuard.  
4. **Букинг**: сущности, миграция, сервисы, guard; подключить проверки в booking-systems и booking.  
5. **Custom page**: сущности, миграция, сервисы, guard; обновить custom-data-ownership и роуты custom pages.  
6. **Фронт**: раздельные экраны/табы «Пользователи и приглашения» для бота, магазина, букинга, страницы; выбор прав по соответствующему enum.

### 6.4. Риски и совместимость

- **Существующие приглашения бота** с полем `permissions`, в которых есть ключи PRODUCTS, SHOP_SETTINGS и т.д.: при чтении игнорировать неизвестные ключи; при сохранении не записывать удалённые ключи (чтобы не ломать JSON). Старые приглашения останутся валидными с точки зрения оставшихся прав бота.  
- **Продукты**: смена роута с `bots/:botId/products` на `shops/:shopId/products` — breaking change для клиентов; нужна версия API или обратная совместимость (редирект/алиас), если есть внешние интеграции.

---

## 7. Чеклист по репозиторию (кратко)

- [ ] Bot: урезать BotEntity, миграция enum и данных, обновить bot-invitation DTO/сервис, bot-notifications (маппинг), все места с BotEntity.*.  
- [ ] Вынести PermissionAction в общий модуль (опционально).  
- [ ] Shop: entity ShopUser, ShopUserPermission, ShopInvitation; enum ShopEntity; миграция; ShopPermissionsService, ShopInvitationsService, ShopPermissionGuard; интеграция в shops, products, categories, orders, cart, shop-promocodes; эндпоинты users/invitations для магазина.  
- [ ] Booking: entity BookingSystemUser, BookingSystemUserPermission, BookingSystemInvitation; enum BookingEntity; миграция; сервисы и guard; интеграция в booking-systems и booking.  
- [ ] Custom page: entity CustomPageUser, CustomPageUserPermission, CustomPageInvitation; enum CustomPageEntity; миграция; сервисы и guard; обновить custom-data-ownership и роуты custom pages.  
- [ ] Фронт: UI прав и приглашений для магазина, букинга, custom page; у бота — только новый набор прав.

---

## 8. Детальный пошаговый план реализации

### Фаза 1: Бот — урезание BotEntity и миграция

**Шаг 1.1.** Файл `backend/src/database/entities/bot-user-permission.entity.ts`  
- В enum `BotEntity` удалить: `PRODUCTS`, `CATEGORIES`, `ORDERS`, `CARTS`, `SPECIALISTS`, `BOOKINGS`, `SHOP_SETTINGS`, `BOOKING_SETTINGS`, `CUSTOM_PAGES`, `SHOP_PROMOCODES`.  
- Оставить: `BOT_SETTINGS`, `FLOWS`, `MESSAGES`, `LEADS`, `ANALYTICS`, `BOT_USERS`, `CUSTOM_DATA`.

**Шаг 1.2.** Миграция (новый файл, например `1700000000055-TrimBotEntityEnum.ts`)  
- Создать новый enum `bot_user_permissions_entity_enum_v2` со значениями: `'bot_settings', 'flows', 'messages', 'leads', 'analytics', 'bot_users', 'custom_data'`.  
- Добавить в таблицу `bot_user_permissions` колонку `entity_new` типа нового enum (nullable).  
- Скопировать в `entity_new` только те строки, где `entity` IN (новые значения); остальные строки (PRODUCTS, CATEGORIES, …) — удалить.  
- Удалить колонку `entity`, переименовать `entity_new` в `entity`, сделать NOT NULL.  
- Удалить старый тип `bot_user_permissions_entity_enum`.  
- В таблице `bot_invitations` поле `permissions` (jsonb) не меняем — при чтении/записи лишние ключи игнорируются в коде.

**Шаг 1.3.** Файл `backend/src/modules/bots/bot-notifications.service.ts`  
- В объекте маппинга названий прав (ENTITY_LABELS) удалить ключи: PRODUCTS, CATEGORIES, ORDERS, CARTS, SPECIALISTS, BOOKINGS, SHOP_SETTINGS, BOOKING_SETTINGS, CUSTOM_PAGES, SHOP_PROMOCODES.  
- Оставить только ключи: BOT_SETTINGS, FLOWS, MESSAGES, LEADS, ANALYTICS, BOT_USERS, CUSTOM_DATA.

**Шаг 1.4.** Файл `backend/src/modules/custom-data/guards/custom-data-ownership.guard.ts`  
- В ветке проверки доступа к кастомной странице (custom page): убрать блок «Проверяем права через систему разрешений бота» (page.botId + hasPermission(..., BotEntity.CUSTOM_PAGES, ...)).  
- Оставить проверки: owner страницы, owner бота, owner магазина. Доступ приглашённых к странице будет добавлен в Фазе 4 (Custom Page permissions).

**Шаг 1.5.** Проверить компиляцию: файлы `bots.controller.ts`, `bot-invitations.service.ts`, `bot-permissions.service.ts`, `analytics.controller.ts`, `leads.controller.ts`, `messages.controller.ts`, `bot-flows.controller.ts` — используют только оставшиеся значения BotEntity; правок не требуется.  
- Файлы `products.controller.ts`, `categories`, `orders`, `cart`, `shop-promocodes` — используют BotEntity.PRODUCTS и др., которые удалены. Их правка выполняется в Фазе 2 после появления ShopEntity и ShopPermissionGuard.

---

### Фаза 2: Магазин — новая модель прав и перенос products/orders/cart/promocodes

**Шаг 2.1.** Общий enum действий (опционально).  
- Создать `backend/src/database/entities/permission-action.entity.ts` (или оставить в bot-user-permission.entity и импортировать оттуда).  
- Здесь оставляем PermissionAction в `bot-user-permission.entity.ts` и импортируем в shop-сущности.

**Шаг 2.2.** Сущности магазина.  
- Создать `backend/src/database/entities/shop-user-permission.entity.ts`: enum `ShopEntity` (SHOP_SETTINGS, PRODUCTS, CATEGORIES, ORDERS, CARTS, PROMOCODES, SHOP_USERS), класс `ShopUserPermission` (shopId, userId, entity, action, granted, grantedByUserId).  
- Создать `backend/src/database/entities/shop-user.entity.ts`: ShopUser (shopId, userId, displayName, permissions jsonb).  
- Создать `backend/src/database/entities/shop-invitation.entity.ts`: ShopInvitation (shopId, invitedTelegramId, invitedUserId, status, permissions jsonb, invitedByUserId, invitationToken, expiresAt).  
- Зарегистрировать в `backend/src/database/entities/index.ts` и в `ALL_ENTITIES`.

**Шаг 2.3.** Миграция для магазина.  
- Создать enum `shop_user_permissions_entity_enum`, типы для статуса приглашений (переиспользовать или создать shop_invitations_status_enum).  
- Таблицы: `shop_users`, `shop_user_permissions`, `shop_invitations` с индексами и FK.

**Шаг 2.4.** Сервисы магазина.  
- `backend/src/modules/shops/shop-permissions.service.ts`: hasAccessToShop, hasPermission, getUserPermissions, setPermission, setBulkPermissions, addUserToShop, removeUserFromShop, getShopUsers, updateShopUserPermissions (private).  
- `backend/src/modules/shops/shop-invitations.service.ts`: createInvitation, acceptInvitation, declineInvitation, getShopInvitations, getUserInvitations, cancelInvitation, getInvitationByToken, cleanupExpired.  
- Подключить Shop, User, ShopUser, ShopUserPermission, ShopInvitation в модуле shops; при необходимости вынести в отдельный shop-users.module или оставить в shops.module.

**Шаг 2.5.** Guard и декоратор для магазина.  
- `backend/src/modules/shops/guards/shop-permission.guard.ts`: из request брать shopId (params.shopId, query.shopId, body.shopId); проверять owner (shop.ownerId === userId) или ShopPermissionsService.hasPermission; декоратор `@ShopPermission(ShopEntity, PermissionAction[])`.  
- `backend/src/modules/shops/decorators/shop-permission.decorator.ts`: аналогично BotPermission.

**Шаг 2.6.** Эндпоинты пользователей и приглашений магазина.  
- В `shops.controller.ts` или отдельном `shop-users.controller.ts`: GET/POST `shops/:shopId/users`, PATCH/DELETE пользователя, GET/POST invitations, accept/decline/cancel по образцу bots.

**Шаг 2.7.** Перенос products на магазин.  
- Роут: с `bots/:botId/products` на `shops/:shopId/products`.  
- Контроллер: JwtAuthGuard + ShopPermissionGuard, декоратор ShopPermission(ShopEntity.PRODUCTS, action).  
- Сервис products уже принимает shopId и validateShopOwnership — заменить validateShopOwnership на проверку: owner или ShopPermissionsService.hasPermission(..., ShopEntity.PRODUCTS, action).  
- Аналогично: categories (роут shops/:shopId/categories), orders (shops/:shopId/orders), cart (shops/:shopId/cart), shop-promocodes (shops/:shopId/promocodes).  
- Модуль products: импорт ShopPermissionGuard, роут заменить на shops/:shopId/products; то же для categories, orders, cart, shop-promocodes.

**Шаг 2.8.** В `shops.service.ts` при проверке доступа (findOne, findAll, update, delete): если userId !== shop.ownerId, проверять hasAccessToShop(userId, shopId); при операциях с настройками — hasPermission(..., SHOP_SETTINGS, action).

---

### Фаза 3: Букинг — новая модель прав

**Шаг 3.1.** Сущности: `booking-system-user-permission.entity.ts` (BookingEntity, BookingSystemUserPermission), `booking-system-user.entity.ts`, `booking-system-invitation.entity.ts`.  
**Шаг 3.2.** Миграция: enum + таблицы booking_system_users, booking_system_user_permissions, booking_system_invitations.  
**Шаг 3.3.** BookingSystemPermissionsService, BookingSystemInvitationsService.  
**Шаг 3.4.** BookingSystemPermissionGuard, декоратор.  
**Шаг 3.5.** Эндпоинты users/invitations для booking-systems.  
**Шаг 3.6.** В booking-systems.service и подмодуле booking: доступ по ownerId или hasPermission(bookingSystemId, BookingEntity.*).

---

### Фаза 4: Custom Page — новая модель прав

**Шаг 4.1.** Сущности: `custom-page-user-permission.entity.ts` (CustomPageEntity: PAGE, CUSTOM_PAGE_USERS), `custom-page-user.entity.ts`, `custom-page-invitation.entity.ts`.  
**Шаг 4.2.** Миграция: enum + таблицы.  
**Шаг 4.3.** CustomPagePermissionsService, CustomPageInvitationsService.  
**Шаг 4.4.** CustomPagePermissionGuard, декоратор.  
**Шаг 4.5.** В custom-data-ownership.guard: для custom page добавить проверку CustomPagePermissionsService.hasPermission(userId, pageId, CustomPageEntity.PAGE, action) если не owner.  
**Шаг 4.6.** Эндпоинты users/invitations для custom pages (если нужны отдельные роуты).

---

Реализация ведётся последовательно: Фаза 1 → Фаза 2 → Фаза 3 → Фаза 4.

---

## 9. Статус реализации

### Сделано

- **Фаза 1 (Бот):**
  - Урезан enum `BotEntity`: удалены PRODUCTS, CATEGORIES, ORDERS, CARTS, SPECIALISTS, BOOKINGS, SHOP_*, BOOKING_*, CUSTOM_PAGES. Оставлены: BOT_SETTINGS, FLOWS, MESSAGES, LEADS, ANALYTICS, BOT_USERS, CUSTOM_DATA.
  - Миграция `1700000000055-TrimBotEntityEnum.ts`: новый enum, удаление старых записей прав, смена типа колонки.
  - Обновлён `bot-notifications.service.ts` (маппинг названий прав).
  - Обновлён `custom-data-ownership.guard.ts`: убрана проверка доступа к custom page через BotEntity.CUSTOM_PAGES (будет в Фазе 4).

- **Фаза 2 (Магазин, частично):**
  - Сущности: `ShopUser`, `ShopUserPermission` (enum `ShopEntity`), `ShopInvitation` (+ `ShopInvitationStatus`).
  - Миграция `1700000000056-AddShopUsersAndPermissions.ts`: таблицы shop_users, shop_user_permissions, shop_invitations.
  - `ShopPermissionsService`: hasAccessToShop, hasPermission, getUserPermissions, setPermission, setBulkPermissions, addUserToShop, removeUserFromShop, getShopUsers.
  - `ShopPermissionGuard` и декоратор `@ShopPermission`.
  - `ShopPermissionsModule` (экспорт сервиса и guard).
  - **Products:** роут переведён с `bots/:botId/products` на `shops/:shopId/products`; guard — `ShopPermissionGuard` + `ShopEntity.PRODUCTS`; в `ProductsService` доступ проверяется через `ShopPermissionsService.hasAccessToShop`.
  - Фронт: `productsService` переведён на `shops/:shopId/products`; добавлены `getShopProducts`, `getShopProductStats`; старые методы помечены `@deprecated` и делегируют в новые (для совместимости при передаче shopId в качестве первого аргумента).

### Осталось

- **Фаза 2:** categories, orders, cart, shop-promocodes перевести на роут `shops/:shopId/...` и `ShopPermissionGuard`; эндпоинты users/invitations для магазина (ShopInvitationsService, контроллер); при необходимости — фронт для выбора shopId в местах, где раньше передавался botId.
- **Фаза 3:** букинг — сущности, миграция, сервисы, guard, интеграция.
- **Фаза 4:** custom page — сущности, миграция, сервисы, guard, обновление custom-data-ownership.
- **Фронт:** экраны «Пользователи и приглашения» для магазина (и далее для букинга, custom page); у бота — только новый набор прав в UI.
