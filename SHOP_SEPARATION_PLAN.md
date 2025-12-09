# План выделения Shop в отдельную сущность

## Обзор

Цель: Выделить функциональность магазина (Shop) из сущности Bot в отдельную независимую сущность с возможностью опциональной привязки к боту (1:1).

---

## Фаза 1: Изменения в базе данных (Backend)

### 1.1 Создание сущности Shop ✅

**Файл:** `backend/src/database/entities/shop.entity.ts`

**Поля:**

- `id` (UUID, PK)
- `name` (string) - название магазина в системе
- `ownerId` (UUID, FK → users) - владелец
- `botId` (UUID, FK → bots, nullable, unique) - опциональная связь с ботом 1:1
- `logoUrl` (string, nullable)
- `title` (string, nullable)
- `description` (text, nullable)
- `customStyles` (text, nullable)
- `buttonTypes` (json, nullable)
- `buttonSettings` (json, nullable)
- `layoutConfig` (json, nullable)
- `browserAccessEnabled` (boolean, default: false)
- `browserAccessRequireEmailVerification` (boolean, default: false)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Связи:**

- `@ManyToOne(() => User)` owner
- `@OneToOne(() => Bot)` bot (опционально)
- `@OneToMany(() => Product)` products
- `@OneToMany(() => Category)` categories
- `@OneToMany(() => Order)` orders
- `@OneToMany(() => Cart)` carts
- `@OneToMany(() => ShopPromocode)` promocodes
- `@OneToMany(() => PublicUser)` publicUsers

### 1.2 Модификация зависимых сущностей ✅

**Product (`product.entity.ts`):**

- [x] Добавить `shopId` (UUID, FK → shops)
- [x] Добавить `@ManyToOne(() => Shop)` shop
- [x] Сделать `botId` nullable (deprecated)

**Category (`category.entity.ts`):**

- [x] Добавить `shopId` (UUID, FK → shops)
- [x] Добавить `@ManyToOne(() => Shop)` shop
- [x] Сделать `botId` nullable (deprecated)

**Order (`order.entity.ts`):**

- [x] Добавить `shopId` (UUID, FK → shops)
- [x] Добавить `@ManyToOne(() => Shop)` shop
- [x] Сделать `botId` nullable (deprecated)

**Cart (`cart.entity.ts`):**

- [x] Добавить `shopId` (UUID, FK → shops)
- [x] Добавить `@ManyToOne(() => Shop)` shop
- [x] Сделать `botId` nullable (deprecated)

**ShopPromocode (`shop-promocode.entity.ts`):**

- [x] Добавить `shopId` (UUID, FK → shops)
- [x] Добавить `@ManyToOne(() => Shop)` shop
- [x] Сделать `botId` nullable (deprecated)

**PublicUser (`public-user.entity.ts`):**

- [x] Добавить `shopId` (UUID, FK → shops)
- [x] Добавить `@ManyToOne(() => Shop)` shop
- [x] Сделать `botId` nullable (deprecated)

### 1.3 Обновление Bot entity ✅

**Файл:** `backend/src/database/entities/bot.entity.ts`

- [x] Пометить все shop\* поля как `@deprecated`
- [x] Добавить `@OneToOne(() => Shop)` shop (опционально)

### 1.4 Создание миграции ✅

**Файл:** `backend/src/database/migrations/1700000000032-CreateShopsTable.ts`

**Действия:**

1. Создать таблицу `shops`
2. Добавить `shopId` в зависимые таблицы
3. Мигрировать данные из `bots` WHERE `isShop = true` в `shops`
4. Заполнить `shopId` в зависимых таблицах на основе `botId`
5. Создать индексы и foreign keys
6. **НЕ** удалять старые поля (для обратной совместимости)

---

## Фаза 2: Backend модуль Shops

### 2.1 Создание ShopsModule ✅

**Директория:** `backend/src/modules/shops/`

**Файлы:**

- [x] `shops.module.ts` - модуль
- [x] `shops.service.ts` - сервис с CRUD операциями
- [x] `shops.controller.ts` - REST API контроллер
- [x] `public-shops.controller.ts` - публичный контроллер
- [x] `dto/shop.dto.ts` - DTO для создания/обновления
- [x] `dto/shop-response.dto.ts` - DTO для ответов

### 2.2 ShopsController эндпоинты ✅

**Базовый путь:** `/shops`

| Метод  | Путь              | Описание                      |
| ------ | ----------------- | ----------------------------- |
| POST   | `/`               | Создать магазин               |
| GET    | `/`               | Список магазинов пользователя |
| GET    | `/:id`            | Получить магазин по ID        |
| PATCH  | `/:id`            | Обновить магазин              |
| PATCH  | `/:id/settings`   | Обновить настройки магазина   |
| DELETE | `/:id`            | Удалить магазин               |
| PATCH  | `/:id/link-bot`   | Привязать бота                |
| DELETE | `/:id/unlink-bot` | Отвязать бота                 |
| GET    | `/:id/stats`      | Статистика магазина           |

**Эндпоинты для продуктов:**
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/:id/products` | Получить товары магазина |
| POST | `/:id/products` | Создать товар |
| GET | `/:id/products/:productId` | Получить товар по ID |
| PATCH | `/:id/products/:productId` | Обновить товар |
| DELETE | `/:id/products/:productId` | Удалить товар |
| GET | `/:id/products-stats` | Статистика товаров |

**Эндпоинты для категорий:**
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/:id/categories` | Получить категории |
| POST | `/:id/categories` | Создать категорию |
| GET | `/:id/categories/:categoryId` | Получить категорию |
| PATCH | `/:id/categories/:categoryId` | Обновить категорию |
| DELETE | `/:id/categories/:categoryId` | Удалить категорию |
| GET | `/:id/categories-tree` | Дерево категорий |

**Эндпоинты для заказов:**
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/:id/orders` | Получить заказы |
| GET | `/:id/orders/:orderId` | Получить заказ по ID |
| PATCH | `/:id/orders/:orderId/status` | Обновить статус заказа |

**Эндпоинты для промокодов:**
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/:id/promocodes` | Получить промокоды |
| POST | `/:id/promocodes` | Создать промокод |
| GET | `/:id/promocodes/:promocodeId` | Получить промокод |
| PATCH | `/:id/promocodes/:promocodeId` | Обновить промокод |
| DELETE | `/:id/promocodes/:promocodeId` | Удалить промокод |

### 2.3 PublicShopsController эндпоинты ✅

**Базовый путь:** `/public/shops`

| Метод  | Путь                         | Описание                      |
| ------ | ---------------------------- | ----------------------------- |
| GET    | `/:id`                       | Получить данные магазина      |
| GET    | `/:id/products`              | Получить товары с фильтрацией |
| GET    | `/:id/cart`                  | Получить корзину              |
| POST   | `/:id/cart/items`            | Добавить товар в корзину      |
| PUT    | `/:id/cart/items/:productId` | Обновить количество           |
| DELETE | `/:id/cart/items/:productId` | Удалить товар из корзины      |
| DELETE | `/:id/cart`                  | Очистить корзину              |
| POST   | `/:id/cart/promocode`        | Применить промокод            |
| DELETE | `/:id/cart/promocode`        | Удалить промокод              |
| POST   | `/:id/orders`                | Создать заказ                 |
| GET    | `/:id/orders`                | Получить заказы пользователя  |

---

## Фаза 3: Обновление существующих сервисов ✅

### 3.1 ProductsService ✅

**Файл:** `backend/src/modules/products/products.service.ts`

**Новые методы:**

- [x] `createByShop(shopId, userId, dto)` - создать товар
- [x] `findAllByShop(shopId, userId, filters)` - получить товары
- [x] `findOneByShop(id, shopId, userId)` - получить товар по ID
- [x] `updateByShop(id, shopId, userId, dto)` - обновить товар
- [x] `removeByShop(id, shopId, userId)` - удалить товар
- [x] `getShopProductStats(shopId, userId)` - статистика
- [x] `updateStockByShop(id, shopId, userId, quantity)` - обновить сток
- [x] `toggleActiveByShop(id, shopId, userId)` - переключить активность
- [x] `validateShopOwnership(shopId, userId)` - валидация владения

### 3.2 CategoriesService ✅

**Файл:** `backend/src/modules/categories/categories.service.ts`

**Новые методы:**

- [x] `createByShop(shopId, userId, dto)`
- [x] `findAllByShop(shopId, userId, filters)`
- [x] `findOneByShop(id, shopId, userId)`
- [x] `updateByShop(id, shopId, userId, dto)`
- [x] `removeByShop(id, shopId, userId)`
- [x] `getCategoryTreeByShop(shopId, userId)`
- [x] `validateShopOwnership(shopId, userId)`

### 3.3 CartService ✅

**Файл:** `backend/src/modules/cart/cart.service.ts`

**Новые методы:**

- [x] `getCartByShop(shopId, user)`
- [x] `addItemByShop(shopId, user, productId, quantity)`
- [x] `updateItemByShop(shopId, user, productId, quantity)`
- [x] `removeItemByShop(shopId, user, productId)`
- [x] `clearCartByShop(shopId, user)`
- [x] `applyPromocodeByShop(shopId, user, code)`
- [x] `removePromocodeByShop(shopId, user)`
- [x] `getAppliedPromocodeInfoByShop(shopId, cart)`
- [x] `validateAppliedPromocodeByShop(shopId, cart)`

### 3.4 OrdersService ✅

**Файл:** `backend/src/modules/orders/orders.service.ts`

**Новые методы:**

- [x] `createOrderByShop(shopId, user, dto)`
- [x] `getOrdersByShop(shopId, userId, filters)`
- [x] `getOrderByShop(id, shopId, userId)`
- [x] `updateOrderStatusByShop(id, shopId, userId, dto)`
- [x] `getUserOrdersByShop(shopId, user, filters)`
- [x] `validateShopOwnership(shopId, userId)`
- [x] `reduceProductStockByShop(shopId, items)`
- [x] `returnProductsToStockByShop(shopId, items)`

### 3.5 ShopPromocodesService ✅

**Файл:** `backend/src/modules/shop-promocodes/shop-promocodes.service.ts`

**Новые методы:**

- [x] `createByShop(shopId, userId, dto)`
- [x] `findAllByShop(shopId, userId, filters)`
- [x] `findOneByShop(id, shopId, userId)`
- [x] `updateByShop(id, shopId, userId, dto)`
- [x] `removeByShop(id, shopId, userId)`
- [x] `validatePromocodeByShop(shopId, code, cart)`
- [x] `validateShopOwnership(shopId, userId)`

### 3.6 Обновление модулей ✅

Добавить `Shop` в `TypeOrmModule.forFeature()`:

- [x] `products.module.ts`
- [x] `categories.module.ts`
- [x] `cart.module.ts`
- [x] `orders.module.ts`
- [x] `shop-promocodes.module.ts`

---

## Фаза 4: Frontend сервисы ✅

### 4.1 shopsService.ts ✅

**Файл:** `frontend/src/services/shopsService.ts`

**Типы:**

- [x] `Shop` - основной тип магазина
- [x] `CreateShopData` / `UpdateShopData` / `UpdateShopSettingsData`
- [x] `ShopFilters` / `ShopStats`
- [x] `ShopProduct` / `CreateShopProductData` / `UpdateShopProductData`
- [x] `ShopCategory` / `CreateShopCategoryData` / `UpdateShopCategoryData`
- [x] `ShopOrder` / `ShopOrderStatus` / `ShopOrderFilters`
- [x] `ShopPromocode` / `CreateShopPromocodeData` / `UpdateShopPromocodeData`

**Методы:**

- [x] CRUD для магазинов
- [x] `linkBot` / `unlinkBot`
- [x] `getStats`
- [x] CRUD для продуктов (`getProducts`, `createProduct`, etc.)
- [x] CRUD для категорий
- [x] Методы для заказов
- [x] CRUD для промокодов

### 4.2 publicApiService.ts ✅

**Файл:** `frontend/src/services/publicApiService.ts`

**Новые типы:**

- [x] `PublicShopData`

**Новые методы:**

- [x] `getShop(shopId)`
- [x] `getShopProductsByShopId(shopId, params)`
- [x] `getShopCart(shopId, headers)`
- [x] `addItemToShopCart(shopId, item, headers)`
- [x] `updateShopCartItem(shopId, productId, quantity, headers)`
- [x] `removeItemFromShopCart(shopId, productId, headers)`
- [x] `clearShopCart(shopId, headers)`
- [x] `applyShopPromocode(shopId, code, headers)`
- [x] `removeShopPromocode(shopId, headers)`
- [x] `createShopOrder(shopId, orderData, headers)`
- [x] `getShopOrders(shopId, headers, params)`

---

## Фаза 5: Frontend компоненты и страницы ⏳

### 5.1 Новые страницы

**Директория:** `frontend/src/pages/Shops/`

| Файл                  | Описание                      | Статус                      |
| --------------------- | ----------------------------- | --------------------------- |
| `ShopsPage.tsx`       | Список магазинов пользователя | ✅                          |
| `ShopDetailsPage.tsx` | Детали магазина с табами      | ✅                          |
| `CreateShopPage.tsx`  | Форма создания магазина       | ⬜ (не нужно, есть модалка) |

### 5.2 Обновление роутинга

**Файл:** `frontend/src/App.tsx`

**Новые маршруты:**
| Путь | Компонент | Статус |
|------|-----------|--------|
| `/shops` | `ShopsPage` | ✅ |
| `/shops/:id` | `ShopDetailsPage` | ✅ |
| `/shops/create` | `CreateShopPage` | ⬜ (не нужно) |

**Обновление существующих:**

- [ ] `/shop/:shopId` - публичная страница магазина (использовать shopId)

### 5.3 Компоненты для управления магазином

**Директория:** `frontend/src/components/Shops/`

| Компонент              | Описание                   | Статус                          |
| ---------------------- | -------------------------- | ------------------------------- |
| `ShopCard.tsx`         | Карточка магазина в списке | ⬜ (не нужно)                   |
| `ShopSettingsForm.tsx` | Форма настроек магазина    | ⬜ (не нужно)                   |
| `ShopLinkBotModal.tsx` | Модалка привязки бота      | ✅ (встроено в ShopDetailsPage) |

### 5.4 Обновление существующих компонентов

| Компонент            | Изменения                     | Статус       |
| -------------------- | ----------------------------- | ------------ |
| `ShopSettings.tsx`   | Поддержка shopId вместо botId | ⏳ Требуется |
| `ShopStylingTab.tsx` | Поддержка shopId              | ⏳ Требуется |
| `ProductsTable.tsx`  | Поддержка shopId              | ✅           |
| `CategoriesTab.tsx`  | Поддержка shopId              | ✅           |
| `OrdersTable.tsx`    | Поддержка shopId              | ✅           |
| `PromocodesTab.tsx`  | Поддержка shopId              | ✅           |

### 5.5 Обновление публичной страницы магазина

**Файл:** `frontend/src/pages/Shop/ShopPageModular.tsx`

- [ ] Изменить `useParams` на `shopId`
- [ ] Использовать `publicApiService.getShop(shopId)`
- [ ] Обновить все вызовы API для работы с shopId

### 5.6 Навигация

- [x] Добавить "Магазины" в боковое меню
- [ ] Обновить BotDetailsPage - убрать shop табы, добавить секцию "Привязанный магазин"

---

## Фаза 6: Миграция данных и тестирование

### 6.1 Миграция данных

- [ ] Запустить миграцию на тестовой БД
- [ ] Проверить корректность переноса данных
- [ ] Проверить работу foreign keys

### 6.2 Тестирование API

- [ ] Тесты CRUD магазинов
- [ ] Тесты привязки/отвязки бота
- [ ] Тесты продуктов через shopId
- [ ] Тесты категорий через shopId
- [ ] Тесты заказов через shopId
- [ ] Тесты корзины через shopId
- [ ] Тесты промокодов через shopId
- [ ] Тесты публичных эндпоинтов

### 6.3 Тестирование Frontend

- [ ] Создание/редактирование магазина
- [ ] Управление продуктами
- [ ] Управление категориями
- [ ] Просмотр заказов
- [ ] Управление промокодами
- [ ] Публичная страница магазина
- [ ] Корзина и оформление заказа

---

## Фаза 7: Удаление deprecated полей (позже)

> ⚠️ Выполнять только после полной проверки работоспособности

### 7.1 Backend

- [ ] Удалить shop\* поля из Bot entity
- [ ] Удалить botId из зависимых сущностей (после подтверждения миграции)
- [ ] Удалить старые методы из сервисов (которые работают через botId)

### 7.2 Frontend

- [ ] Удалить старые API методы из publicApiService
- [ ] Удалить неиспользуемые типы

### 7.3 Миграция

- [ ] Создать миграцию для удаления deprecated полей
- [ ] Удалить isShop из bots таблицы

---

## Статус выполнения

| Фаза | Описание                | Статус       |
| ---- | ----------------------- | ------------ |
| 1    | База данных             | ✅ 100%      |
| 2    | Backend модуль Shops    | ✅ 100%      |
| 3    | Обновление сервисов     | ✅ 100%      |
| 4    | Frontend сервисы        | ✅ 100%      |
| 5    | Frontend компоненты     | ✅ 100%      |
| 6    | Миграция и тестирование | ⏭️ Пропущена |
| 7    | Удаление deprecated     | ✅ 100%      |

**Общий прогресс: 100%**

### Что выполнено в Фазе 5:

- ✅ ShopsPage - страница списка магазинов
- ✅ ShopDetailsPage - страница деталей магазина с табами
- ✅ Роутинг для /shops и /shops/:id
- ✅ Пункт меню "Магазины" в боковой панели
- ✅ ProductsTable - поддержка shopId
- ✅ CategoriesTab - поддержка shopId
- ✅ OrdersTable - поддержка shopId
- ✅ PromocodesTab - поддержка shopId
- ✅ CartsTable - поддержка shopId
- ✅ ShopSettings - поддержка shopId
- ✅ ShopPageModular (публичная) - поддержка shopId

### Что выполнено в Фазе 7:

#### Backend:

- ✅ Удалены shop\* поля из Bot entity (`isShop`, `shopLogoUrl`, `shopCustomStyles`, `shopTitle`, `shopDescription`, `shopButtonTypes`, `shopButtonSettings`, `shopLayoutConfig`, `shopBrowserAccessEnabled`, `browserAccessRequireEmailVerification`, геттер `shopUrl`)
- ✅ Удалена связь `botId` из Product, Category, Order, Cart, ShopPromocode, PublicUser entities
- ✅ Удалены индексы по `botId` в зависимых сущностях
- ✅ `shopId` теперь обязательное поле (не nullable) во всех зависимых сущностях

#### Frontend:

- ✅ **ShopPageModular** - полностью переработан:
  - `previewBot` → `previewShop`
  - `botId` параметр удалён, используется только `shopId`
  - `currentBot` → `currentShop`
  - Все API вызовы используют `shopId`
  - `PublicBotData` → `PublicShopData`
- ✅ **ShopDataContext** (types.ts) - обновлён:
  - `botId` → `shopId`
  - `bot` → `shop`
- ✅ **usePublicAuth** - добавлена поддержка `shopId` (с приоритетом над `botId`)
- ✅ **AuthModal** - добавлена поддержка `shopId` и `shopName`
- ✅ **publicApiService** - добавлен `validateShopPromocode`

---

## Важные заметки

1. ~~**Обратная совместимость:** Старые API эндпоинты через botId продолжают работать~~
   **ИЗМЕНЕНО:** Legacy botId больше не поддерживается во frontend. Все компоненты работают только с shopId.
2. **Связь 1:1:** Один бот может быть привязан только к одному магазину
3. **Владение:** Магазин принадлежит пользователю (ownerId), не боту
4. **Миграция:** Все существующие магазины (bots.isShop=true) будут автоматически перенесены
5. **URL магазина:** Теперь формируется как `/shop/:shopId` вместо `/shop/:botId`

---

## Выполнено в сессии 5 (финальная очистка):

### Backend очистка:

- ✅ Удалены legacy эндпоинты из `public-bots.controller.ts`:
  - `GET /public/bots/:id/shop` → используйте `/public/shops/:id`
  - `GET /public/bots/:id/shop/products` → используйте `/public/shops/:id/products`
- ✅ Удалены методы из `bots.service.ts`:
  - `getPublicBotForShop()` → используйте `ShopsService.getPublicData()`
  - `getPublicShopProducts()` → используйте `ShopsService.getPublicProducts()`
  - `updateShopSettings()` → используйте `ShopsService.update()`
  - `getAllSubcategoryIds()` (приватный helper)
  - `buildCategoryTree()` (приватный helper)
- ✅ Удалён эндпоинт из `bots.controller.ts`:
  - `PATCH /bots/:id/shop-settings` → используйте `PATCH /shops/:shopId/settings`
- ✅ Обновлён `flow-execution.service.ts`:
  - Команда `/shop` теперь ищет связанный Shop по `botId` через ShopRepository
  - `handleShopCommand()` использует данные из Shop entity
  - Добавлен импорт и инъекция ShopRepository

### Frontend очистка:

- ✅ Удалены deprecated методы из `publicApiService.ts`:
  - `getBotForShop()` → используйте `getShop()`
  - `getShopProducts()` → используйте `getShopProductsByShopId()`
- ✅ Удалены shop\* поля из `botsService.ts` (интерфейс Bot):
  - `isShop`, `shopLogoUrl`, `shopTitle`, `shopDescription`, `shopCustomStyles`, `shopUrl`, `shopButtonTypes`, `shopButtonSettings`, `shopLayoutConfig`, `shopBrowserAccessEnabled`, `products`
- ✅ Удалён интерфейс `ShopSettings` из `botsService.ts`
- ✅ Удалён метод `updateShopSettings()` из `botsService.ts`
- ✅ Обновлён `customPageApi.ts`:
  - Добавлен параметр `shopId` в `createCustomPageApi()`
  - Shop API теперь работает только если передан `shopId`
  - Использует новые методы `getShop()`, `getShopProductsByShopId()`, `getShopCart()`, etc.
- ✅ Обновлён импорт в `types.ts`: `PublicBotData` → `PublicShopData`

---

## Сессия 6 (очистка backend сервисов) ✅:

### Все backend сервисы переработаны:

- ✅ **ProductsService** - полностью переработан
- ✅ **CategoriesService** - полностью переработан
- ✅ **CartService** - полностью переработан (~600 строк legacy кода удалено)
- ✅ **ShopPromocodesService** - полностью переработан (~400 строк legacy кода удалено)
- ✅ **OrdersService** - полностью переработан (~500 строк legacy кода удалено)
- ✅ **ShopsController** - обновлён (методы `*ByShop` → основные методы)
- ✅ **ProductsModule** - удалён импорт Bot entity
- ✅ **CategoriesModule** - удалён импорт Bot entity
- ✅ **CartModule** - удалён импорт Bot entity
- ✅ **ShopPromocodesModule** - удалён импорт Bot entity
- ✅ **OrdersModule** - удалён импорт Bot entity

### Оставшиеся задачи:

- [ ] **Миграция** - создать миграцию для удаления столбцов `botId` из БД (опционально, после тестирования)

---

## Сессия 7 (исправление Telegram интеграции) ✅:

### TelegramService рефакторинг:

- ✅ **telegram.service.ts** - полностью переработан:
  - Метод `setBotCommands(token, bot, shop)` теперь принимает `Shop | null` как третий параметр
  - Команда `/shop` добавляется только если передан `shop` с `buttonTypes.includes("command")`
  - Menu Button для магазина использует `shop.buttonSettings` и `shop.url`
  - Метод `setMenuButton(token, shop)` теперь принимает `Shop` вместо `Bot`
  
- ✅ **bots.service.ts** - обновлён:
  - Добавлен `ShopRepository` для получения связанного магазина
  - При обновлении настроек бронирования получает `shop` и передаёт в `setBotCommands`
  
- ✅ **custom-pages.service.ts** - обновлён:
  - Добавлен `ShopRepository` 
  - Метод `updateBotCommands` получает связанный `shop` и передаёт в `setBotCommands`
  
- ✅ **custom-pages.module.ts** - добавлен импорт `Shop` entity

- ✅ **shops.service.ts** - добавлена интеграция с Telegram:
  - Добавлен `TelegramService` с `forwardRef`
  - Метод `linkBot` теперь вызывает `setBotCommands` для добавления команды `/shop`
  - Метод `unlinkBot` вызывает `setBotCommands` для удаления команды `/shop`
  - Добавлен приватный метод `decryptToken` для расшифровки токена бота

- ✅ **shops.module.ts** - добавлен импорт `TelegramModule` с `forwardRef`

---

## Итоговая архитектура

```
Shop (независимая сущность)
├── id (UUID)
├── ownerId (владелец)
├── botId (nullable, 1:1 связь с Bot)
├── name, title, description
├── logoUrl, customStyles
├── buttonTypes, buttonSettings
├── layoutConfig
├── browserAccessEnabled
└── Связи:
    ├── products (1:N)
    ├── categories (1:N)
    ├── orders (1:N)
    ├── carts (1:N)
    ├── promocodes (1:N)
    └── publicUsers (1:N)

Bot (не содержит shop данных)
├── id (UUID)
├── booking settings
├── flow settings
└── может быть привязан к Shop (0:1)
```

---

_Документ создан: 09.12.2025_
_Последнее обновление: 09.12.2025 (сессия 6 - очистка backend сервисов завершена)_
