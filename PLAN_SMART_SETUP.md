# Smart Setup Wizard — "Умная настройка"

> **Статус:** Запланировано
> **Дата:** 2025-02-08

## Обзор

Реализация системы "Умной настройки": (1) новые сущности FlowPreset и OnboardingTemplate в БД, (2) админ-панель для управления пресетами и шаблонами, (3) миграция существующих фронтенд-пресетов в БД, (4) визард на Dashboard для пользователей, (5) серверная оркестрация создания сущностей.

## Задачи

- [ ] Backend: Создать entities FlowPreset и OnboardingTemplate + миграции
- [ ] Backend: Админ-контроллер для CRUD flow-пресетов (admin/flow-presets)
- [ ] Backend: Админ-контроллер для CRUD onboarding-шаблонов (admin/onboarding-templates)
- [ ] Backend: Seed-миграция — перенести 18 flow-пресетов из фронтенда в БД
- [ ] Backend: Seed-миграция — создать начальные onboarding-шаблоны по нишам
- [ ] Backend: OnboardingModule (controller, service, DTOs) — оркестрация setup
- [ ] Frontend: Админ-страница управления flow-пресетами с превью
- [ ] Frontend: Админ-страница управления onboarding-шаблонами
- [ ] Frontend: Рефакторинг PresetSelector — загрузка из API вместо локальных файлов
- [ ] Frontend: Удалить frontend/src/flowPresets/ после миграции на API
- [ ] Frontend: Компонент SmartSetupWizard + шаги + кнопка на Dashboard
- [ ] Frontend: Переводы для визарда и админ-страниц на 5 языков

---

## Общая архитектура

```
┌─────────────────────────────────────────────────────────┐
│                      Админ-панель                       │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Управление          │  │ Управление onboarding-   │  │
│  │ flow-пресетами      │  │ шаблонами                │  │
│  └─────────┬───────────┘  └────────────┬─────────────┘  │
└────────────┼───────────────────────────┼────────────────┘
             │                           │
             ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│                      База данных                        │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ FlowPreset          │◄─┤ OnboardingTemplate       │  │
│  │ (nodes, edges, ...)  │  │ (entities, collections)  │  │
│  └─────────────────────┘  └──────────────────────────┘  │
└────────────┬───────────────────────────┬────────────────┘
             │                           │
             ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Пользовательский поток                  │
│  Dashboard → SmartSetupWizard → POST /onboarding/setup  │
│              GET /onboarding/templates                   │
│                         │                               │
│                         ▼                               │
│              Создание сущностей (Shop, Booking,         │
│              CustomPages, Bot + Flows, CustomData)       │
└─────────────────────────────────────────────────────────┘
```

## Шаги визарда

```
Шаг 1: Категория бизнеса
    ↓
Шаг 2: Ниша / детали
    ↓
Шаг 3: Данные бизнеса (название, описание)
    ↓
Шаг 4: Нужен ли TG-бот?
    ├── Да → Шаг 4a: Настройка бота (токен, имя)
    └── Нет ─┐
             ↓
Шаг 5: Подтверждение
    ↓
Шаг 6: Создание (прогресс)
    ↓
Шаг 7: Итоги и советы по донастройке
```

---

## Часть 1: Новые сущности в БД

### 1.1 `FlowPreset` entity

**Путь:** `backend/src/database/entities/flow-preset.entity.ts`

```typescript
@Entity('flow_presets')
class FlowPreset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;                    // "Поддержка клиентов"

  @Column({ nullable: true })
  description: string;             // "Автоматизированная система поддержки..."

  @Column()
  category: string;                // "Поддержка", "Продажи", "E-commerce", ...

  @Column({ type: 'jsonb' })
  flowData: {                      // Полная структура flow (nodes + edges)
    nodes: FlowNodeDto[];
    edges: FlowEdgeDto[];
    viewport?: { x: number; y: number; zoom: number };
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 1.2 `OnboardingTemplate` entity

**Путь:** `backend/src/database/entities/onboarding-template.entity.ts`

```typescript
@Entity('onboarding_templates')
class OnboardingTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  category: string;                // "CATERING", "BEAUTY", "RETAIL", ...

  @Column()
  niche: string;                   // "cafe", "barbershop", "clothing_store"

  @Column()
  label: string;                   // "Кафе"

  @Column({ nullable: true })
  description: string;             // "Настройка для кафе с меню и заказами"

  @Column({ nullable: true })
  icon: string;                    // Emoji или имя иконки

  // Какие сущности создавать
  @Column({ type: 'jsonb' })
  entities: {
    shop?: {
      defaultCategories: string[];
      settings: Record<string, any>;
    };
    bookingSystem?: {
      defaultServices: string[];
      settings: Record<string, any>;
    };
    customPages?: {
      title: string;
      template: string;
      pageType: 'inline' | 'static';
    };
  };

  // Ссылки на flow-пресеты (UUID[]) — применяются если пользователь выбрал бота
  @Column({ type: 'jsonb', default: [] })
  flowPresetIds: string[];

  // Кастомные коллекции данных
  @Column({ type: 'jsonb', default: [] })
  customCollections: OnboardingCustomCollection[];

  // Рекомендация по боту
  @Column({ default: false })
  botRecommended: boolean;

  @Column({ nullable: true })
  botRecommendationReason: string;

  // Советы по донастройке
  @Column({ type: 'jsonb', default: [] })
  setupTips: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Тип `OnboardingCustomCollection`** (хранится в JSONB):

```typescript
interface OnboardingCustomCollection {
  ownerEntity: 'shop' | 'bookingSystem' | 'bot' | 'customPage';
  collectionName: string;
  displayName: string;
  description?: string;
  icon?: string;
  schema: CollectionSchemaDefinition;
  accessSettings?: {
    public?: { read: boolean; list: boolean; create: boolean };
    authenticated?: { read: boolean; list: boolean; create: boolean; update: boolean; delete: boolean };
  };
  seedData?: Record<string, any>[];
}
```

**Примеры кастомных коллекций по нишам:**

- **Кафе/Ресторан**: коллекция `table_orders` (привязана к Shop) — номер столика, статус заказа, комментарий гостя; коллекция `menu_sections` — разделы меню с порядком отображения
- **Салон красоты**: коллекция `client_preferences` (привязана к BookingSystem) — предпочтения клиента, аллергии, история процедур
- **Образование**: коллекция `student_progress` (привязана к BookingSystem) — прогресс ученика, оценки, домашние задания
- **Услуги**: коллекция `service_requests` (привязана к BookingSystem) — заявки с фото, адресом, описанием проблемы

---

## Часть 2: Админ-панель

### 2.1 Backend: Админ-контроллеры

#### `AdminFlowPresetsController`

**Путь:** `backend/src/modules/admin/controllers/admin-flow-presets.controller.ts`

Эндпоинты (по паттерну `admin-openrouter.controller.ts`):

- `GET /admin/flow-presets` — список пресетов (пагинация, поиск, фильтр по category)
- `GET /admin/flow-presets/:id` — один пресет (для редактирования)
- `POST /admin/flow-presets` — создать пресет
- `PUT /admin/flow-presets/:id` — обновить пресет
- `DELETE /admin/flow-presets/:id` — удалить пресет
- `POST /admin/flow-presets/:id/duplicate` — дублировать пресет

#### `AdminOnboardingTemplatesController`

**Путь:** `backend/src/modules/admin/controllers/admin-onboarding-templates.controller.ts`

- `GET /admin/onboarding-templates` — список шаблонов
- `GET /admin/onboarding-templates/:id` — один шаблон
- `POST /admin/onboarding-templates` — создать шаблон
- `PUT /admin/onboarding-templates/:id` — обновить шаблон
- `DELETE /admin/onboarding-templates/:id` — удалить шаблон
- `POST /admin/onboarding-templates/:id/test` — тестовый запуск (создает сущности для тестового пользователя)

### 2.2 Frontend: Админ-страницы

#### `AdminFlowPresetsPage`

**Путь:** `frontend/src/pages/Admin/FlowPresets/AdminFlowPresetsPage.tsx`

- Таблица пресетов с колонками: Название, Категория, Кол-во нод, Статус, Дата изменения
- Поиск и фильтр по категории
- Модалка создания/редактирования:
  - Поля: name, description, category, isActive
  - **Встроенный FlowEditor** для визуального редактирования `flowData` (переиспользуем существующий `FlowBuilder` в read/edit режиме)
  - Кнопка "Превью" — рендерит flow в режиме просмотра

#### `AdminOnboardingTemplatesPage`

**Путь:** `frontend/src/pages/Admin/OnboardingTemplates/AdminOnboardingTemplatesPage.tsx`

- Таблица шаблонов с колонками: Категория, Ниша, Создаваемые сущности, Пресеты, Статус
- Модалка создания/редактирования:
  - Основное: category, niche, label, description, icon
  - Сущности: чекбоксы Shop/Booking/CustomPages + настройки для каждого
  - Flow-пресеты: мультиселект из списка `FlowPreset` (загружается из API)
  - Кастомные коллекции: динамический список с JSON Schema редактором
  - Рекомендация по боту: botRecommended + botRecommendationReason
  - Советы: динамический список строк

### 2.3 Админ API (`adminApi.ts`)

Добавить модули:

```typescript
export const flowPresetsAdminApi = {
  getAll: (params?) => adminFetch<PaginatedResponse<FlowPreset>>('/admin/flow-presets', params),
  getById: (id) => adminFetch<FlowPreset>(`/admin/flow-presets/${id}`),
  create: (data) => adminFetch<FlowPreset>('/admin/flow-presets', { method: 'POST', body: data }),
  update: (id, data) => adminFetch<FlowPreset>(`/admin/flow-presets/${id}`, { method: 'PUT', body: data }),
  delete: (id) => adminFetch(`/admin/flow-presets/${id}`, { method: 'DELETE' }),
  duplicate: (id) => adminFetch<FlowPreset>(`/admin/flow-presets/${id}/duplicate`, { method: 'POST' }),
};

export const onboardingTemplatesAdminApi = {
  getAll: (params?) => adminFetch<PaginatedResponse<OnboardingTemplate>>('/admin/onboarding-templates', params),
  getById: (id) => adminFetch<OnboardingTemplate>(`/admin/onboarding-templates/${id}`),
  create: (data) => adminFetch<OnboardingTemplate>('/admin/onboarding-templates', { method: 'POST', body: data }),
  update: (id, data) => adminFetch<OnboardingTemplate>(`/admin/onboarding-templates/${id}`, { method: 'PUT', body: data }),
  delete: (id) => adminFetch(`/admin/onboarding-templates/${id}`, { method: 'DELETE' }),
  test: (id) => adminFetch(`/admin/onboarding-templates/${id}/test`, { method: 'POST' }),
};
```

---

## Часть 3: Миграция существующих пресетов

### 3.1 Seed-миграция flow-пресетов

Одноразовая миграция: читает 18 пресетов из `frontend/src/flowPresets/`, конвертирует в `FlowPreset` записи и вставляет в БД.

**Скрипт:** `backend/src/database/seeds/seed-flow-presets.ts`

### 3.2 Seed-миграция onboarding-шаблонов

Создает начальные `OnboardingTemplate` записи с привязкой к `FlowPreset` ID:

- **Общепит** (Кафе, Ресторан, Бар, Кофейня) -> Shop + CustomPage + пресеты: ecommerceShopFlow, productCatalogFlow, orderProcessingFlow
- **Красота** (Салон, Барбершоп, Маникюр) -> BookingSystem + пресеты: appointmentBookingFlow, customerSupportFlow
- **Розничная торговля** (Одежда, Электроника) -> Shop + пресеты: ecommerceShopFlow, productRecommendationFlow, returnRefundFlow
- **Услуги** (Ремонт, Клининг, Доставка) -> BookingSystem + пресеты: appointmentBookingFlow, leadQualificationFlow, customerSupportFlow
- **Образование** (Курсы, Репетитор) -> BookingSystem + пресеты: appointmentBookingFlow, faqFlow, feedbackCollectionFlow

**Скрипт:** `backend/src/database/seeds/seed-onboarding-templates.ts`

### 3.3 Рефакторинг PresetSelector

- `PresetSelector.tsx` переписывается: вместо `import * as presets from '@/flowPresets'` — запрос `GET /flow-presets` (публичный эндпоинт для авторизованных пользователей)
- Добавляется `FlowPresetsController` (не админский) с одним эндпоинтом: `GET /flow-presets` — возвращает активные пресеты

### 3.4 Удаление `frontend/src/flowPresets/`

После успешной миграции и рефакторинга — удалить всю директорию `flowPresets/`.

---

## Часть 4: OnboardingModule

### 4.1 Модуль

**Путь:** `backend/src/modules/onboarding/`

- `onboarding.module.ts`
- `onboarding.controller.ts`
- `onboarding.service.ts`
- `dto/smart-setup.dto.ts`

### 4.2 Эндпоинты

- `GET /onboarding/templates` — список активных шаблонов с вложенными flow-пресетами (для визарда)
- `POST /onboarding/setup` — выполнение настройки

### 4.3 DTO

```typescript
class SmartSetupDto {
  templateId: string;              // UUID выбранного OnboardingTemplate
  businessName: string;
  businessDescription?: string;

  enableBot?: boolean;
  botName?: string;                // обязательно если enableBot = true
  botToken?: string;               // обязательно если enableBot = true

  // Переопределение для "Свободная настройка" или кастомизация
  enableShop?: boolean;
  enableBooking?: boolean;
  enableCustomPages?: boolean;
  selectedFlowPresetIds?: string[];  // для ручного выбора пресетов

  nicheParams?: Record<string, any>;
}
```

### 4.4 `OnboardingService` — оркестратор

1. Загружает `OnboardingTemplate` по `templateId` из БД
2. Вызывает `checkSubscriptionLimits()` (заглушка на будущее)
3. Создает сущности по шаблону:
   - `ShopsService.create()` + `browserAccessEnabled: true` + автогенерация slug
   - `BookingSystemsService.create()` + `browserAccessEnabled: true` + автогенерация slug
   - `CustomPagesService.create()` + автогенерация slug
4. Создает кастомные коллекции данных из `template.customCollections`
5. Если `enableBot = true`:
   - `BotsService.create()`
   - Загружает `FlowPreset` записи по `flowPresetIds` из шаблона (или `selectedFlowPresetIds`)
   - Для каждого пресета: `BotFlowsService.createFlow()` со статусом `active`, первый — `isDefault: true`
   - Привязка сущностей к боту: `linkBot()`
6. Логирует `ONBOARDING_COMPLETED` в ActivityLog
7. Возвращает `SmartSetupResultDto`

Всё в транзакции с откатом при ошибке.

### Дополнительная логика:

**a) Автогенерация slug/субдоменов:**
- На основе `businessName` генерируется slug (транслитерация + kebab-case)
- Проверка уникальности через существующие сервисы
- При конфликте — автоматическое добавление суффикса (`cafe-pushkin` -> `cafe-pushkin-2`)

**b) Автовключение browserAccessEnabled:**
- Для всех Shop и BookingSystem устанавливается `browserAccessEnabled: true`

**c) Заглушка для лимитов подписки:**

```typescript
interface SubscriptionLimitCheck {
  allowed: boolean;
  reason?: string;           // "Превышен лимит ботов для плана START"
  requiredPlan?: string;     // "BUSINESS"
  limits?: {
    bots?: { current: number; max: number };
    shops?: { current: number; max: number };
    bookingSystems?: { current: number; max: number };
  };
}
```

### 4.5 Регистрация

`OnboardingModule` в `app.module.ts` с импортами: `BotsModule`, `ShopsModule`, `BookingSystemsModule`, `CustomPagesModule`, `CustomDataModule`, `TypeOrmModule.forFeature([FlowPreset, OnboardingTemplate])`.

---

## Часть 5: Фронтенд — SmartSetupWizard

### 5.1 Сервис `onboardingService.ts`

```typescript
export const onboardingService = {
  getTemplates: () => api.get<OnboardingTemplate[]>('/onboarding/templates'),
  setup: (data: SmartSetupRequest) => api.post<SmartSetupResult>('/onboarding/setup', data),
};
```

### 5.2 Компонент `SmartSetupWizard`

**Путь:** `frontend/src/components/SmartSetupWizard/`

- `SmartSetupWizard.tsx` — Ant Design Modal + Steps
- `SmartSetupWizard.module.scss`
- `steps/`:
  - `CategoryStep.tsx` — сетка карточек категорий (данные из API)
  - `NicheStep.tsx` — выбор ниши внутри категории
  - `BusinessInfoStep.tsx` — название, описание бизнеса
  - `BotDecisionStep.tsx` — "Нужен ли бот?" + рекомендация из шаблона
  - `BotSetupStep.tsx` — токен и имя бота (условный шаг)
  - `ConfirmStep.tsx` — превью создаваемых сущностей
  - `ProgressStep.tsx` — прогресс
  - `ResultStep.tsx` — итоги со ссылками и советами из шаблона

### 5.3 Кнопка на Dashboard

В `DashboardPage.tsx` — кнопка "Умная настройка" для всех пользователей.

### 5.4 i18n

Переводы на 5 языков (ru, en, pl, de, ua).

---

## Бизнес-ниши и маппинг на сущности

- **Общепит** (Кафе, Ресторан, Бар, Кофейня) -> CustomPage (меню с заказами, номер столика) + Shop (для доставки) + *опционально Bot*:
  - `ecommerceShopFlow` — полный цикл магазина (заказ еды/доставка)
  - `productCatalogFlow` — каталог меню
  - `orderProcessingFlow` — обработка заказов

- **Красота** (Салон, Барбершоп, Маникюр) -> BookingSystem (специалисты, услуги) + *опционально Bot*:
  - `appointmentBookingFlow` — бронирование к специалисту
  - `customerSupportFlow` — ответы на вопросы клиентов

- **Розничная торговля** (Одежда, Электроника) -> Shop (категории, товары) + *опционально Bot*:
  - `ecommerceShopFlow` — полный цикл магазина
  - `productRecommendationFlow` — рекомендации товаров
  - `returnRefundFlow` — обработка возвратов

- **Услуги** (Ремонт, Клининг, Доставка) -> BookingSystem + *опционально Bot*:
  - `appointmentBookingFlow` — запись на услугу
  - `leadQualificationFlow` — квалификация заявок по BANT
  - `customerSupportFlow` — поддержка

- **Образование** (Курсы, Репетитор) -> BookingSystem + *опционально Bot*:
  - `appointmentBookingFlow` — запись на занятие
  - `faqFlow` — FAQ по учебной программе
  - `feedbackCollectionFlow` — сбор обратной связи от учеников

- **Свободная настройка** -> выбранные пользователем компоненты (Shop / Booking / CustomPages) + *опционально Bot* — пользователь сам выбирает flow-пресеты из полного списка

Бот везде опционален. Магазины, системы бронирования и кастомные страницы работают самостоятельно через браузерный доступ по субдомену.

---

## Поток данных (пример для кафе)

```
Админ                           БД
  │                              │
  ├── Создать FlowPreset ───────►│
  ├── Создать OnboardingTemplate►│
  │                              │

Пользователь    Frontend         Backend          БД
  │               │                │               │
  ├─ Умная ──────►│                │               │
  │  настройка    ├─ GET /onboarding/templates ───►│
  │               │◄─ Список шаблонов ─────────────┤
  │               │                │               │
  ├─ Общепит ────►│                │               │
  │  -> Кафе      │                │               │
  ├─ Кафе ───────►│                │               │
  │  Пушкин       │                │               │
  ├─ Бот? Да ────►│                │               │
  │  + токен      │                │               │
  ├─ Подтвердить─►│                │               │
  │               ├─ POST /onboarding/setup ──────►│
  │               │                ├─ Shop ────────►│
  │               │                ├─ CustomPage ──►│
  │               │                ├─ Collections ─►│
  │               │                ├─ Bot ─────────►│
  │               │                ├─ BotFlows ────►│
  │               │                ├─ LinkBot ─────►│
  │               │                ├─ ActivityLog ─►│
  │               │◄─ SmartSetupResult ────────────┤
  │◄─ Сводка ────┤                │               │
  │  + советы     │                │               │
```
