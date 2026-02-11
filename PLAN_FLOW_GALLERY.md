# Flow Template Gallery — Галерея шаблонов Bot Flow

> **Статус:** Реализовано  
> **Дата:** 2025-02-11  
> **Связан с:** PLAN_SMART_SETUP.md (FlowPreset entity)

## Обзор

Галерея шаблонов bot flow с двумя типами темплейтов (полные и частичные), системой публикации пользовательских flow, верификацией через админ-панель и интеграцией в редактор FlowBuilder.

---

## Задачи

- [x] Backend: Entity `FlowTemplate` + миграция
- [x] Backend: Entity `FlowTemplateCategory` (справочник категорий с i18n) + миграция
- [x] Backend: CRUD API для пользовательских темплейтов (`/flow-templates`)
- [x] Backend: Публичный API галереи (`/flow-templates/gallery`)
- [x] Backend: Админ-контроллер для верификации и управления (`/admin/flow-templates`)
- [x] Backend: Админ-контроллер для справочника категорий (`/admin/flow-template-categories`)
- [x] Backend: Уведомления автору при изменении статуса темплейта
- [x] Frontend: Компонент `TemplateGallery` (поиск, фильтр, превью, применение)
- [x] Frontend: Функционал сохранения текущего flow как темплейта
- [x] Frontend: Интеграция галереи в FlowBuilder (кнопка + панель)
- [x] Frontend: Админ-страница управления темплейтами + верификация
- [x] Frontend: Админ-страница справочника категорий
- [x] Frontend: Предпросмотр темплейта (мини-ReactFlow readonly)
- [x] Frontend: Логика мержа частичного темплейта в существующий flow

---

## Архитектура

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Админ-панель                               │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐    │
│  │ Управление темплейтами  │  │ Верификация пользовательских   │    │
│  │ (создание, пометка      │  │ темплейтов                     │    │
│  │  "выбор платформы")     │  │ (approve / reject)             │    │
│  └───────────┬─────────────┘  └──────────────┬─────────────────┘    │
└──────────────┼───────────────────────────────┼──────────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         FlowTemplate (БД)                            │
│                                                                      │
│  type: 'full' | 'partial'                                            │
│  status: 'draft' | 'private' | 'pending_review' | 'published'       │
│  isPlatformChoice: boolean       ← помечается через админку         │
│  authorId: UUID | null           ← null для системных               │
│  flowData: { nodes, edges, viewport }                                │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐   ┌────────────────────────┐
│  Пользователь    │   │  FlowBuilder Editor     │
│  "Мои темплейты" │   │  ┌────────────────────┐ │
│  (private +      │   │  │  Галерея шаблонов   │ │
│   published)     │   │  │  [Поиск] [Фильтр]  │ │
│                  │   │  │  ┌────┐ ┌────┐      │ │
│  "Опубликовать"──┼──►│  │  │Full│ │Part│      │ │
│                  │   │  │  └────┘ └────┘      │ │
│                  │   │  │  [Превью] [Применить]│ │
│                  │   │  └────────────────────┘ │
└──────────────────┘   └────────────────────────┘
```

---

## Часть 1: Entity `FlowTemplate`

### 1.1 Модель данных

**Путь:** `backend/src/database/entities/flow-template.entity.ts`

```typescript
@Entity('flow_templates')
class FlowTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Основное ---

  @Column({ length: 128 })
  name: string;                       // "Поддержка клиентов"

  @Column({ type: 'text', nullable: true })
  description: string;                // "Шаблон автоматизированной поддержки..."

  @Column({ type: 'enum', enum: FlowTemplateType })
  type: FlowTemplateType;             // 'full' | 'partial'

  @ManyToOne(() => FlowTemplateCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: FlowTemplateCategory;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];                     // ["support", "customer", "faq"]

  // --- Содержимое ---

  @Column({ type: 'jsonb' })
  flowData: {
    nodes: FlowNodeDto[];
    edges: FlowEdgeDto[];
    viewport?: { x: number; y: number; zoom: number };
  };

  // --- Публикация ---

  @Column({
    type: 'enum',
    enum: FlowTemplateStatus,
    default: FlowTemplateStatus.DRAFT,
  })
  status: FlowTemplateStatus;
  // 'draft'             — черновик (только автор видит)
  // 'private'           — сохранён для личного использования
  // 'pending_review'    — отправлен на модерацию
  // 'published'         — опубликован в галерее
  // 'rejected'          — отклонён модерацией
  // 'pending_deletion'  — автор запросил удаление, ожидает решения админа
  // 'archived'          — перенесён в архив (soft delete)

  @Column({ default: false })
  isPlatformChoice: boolean;          // Помечен админом как "Выбор платформы"

  @Column({ nullable: true })
  rejectionReason: string;            // Причина отклонения (заполняет админ)

  @Column({ type: 'text', nullable: true })
  deletionRequestReason: string;      // Причина запроса на удаление (заполняет автор)

  // --- Автор ---

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'uuid', nullable: true })
  authorId: string | null;            // null = системный / созданный админом

  // --- Метаданные ---

  @Column({ type: 'int', default: 0 })
  usageCount: number;                 // Сколько раз применён

  @Column({ type: 'int', default: 0 })
  nodeCount: number;                  // Кол-во нод (для отображения)

  @Column({ type: 'int', default: 0 })
  sortOrder: number;                  // Порядок в галерее

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;                  // Дата публикации

  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date;                   // Дата архивации (soft delete)
}
```

### 1.2 Enums

```typescript
enum FlowTemplateType {
  FULL = 'full',         // Полностью заменяет текущий flow
  PARTIAL = 'partial',   // Вставляется в существующий flow
}

enum FlowTemplateStatus {
  DRAFT = 'draft',
  PRIVATE = 'private',
  PENDING_REVIEW = 'pending_review',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  PENDING_DELETION = 'pending_deletion',
  ARCHIVED = 'archived',
}
```

### 1.3 Entity `FlowTemplateCategory` — справочник категорий

**Путь:** `backend/src/database/entities/flow-template-category.entity.ts`

```typescript
@Entity('flow_template_categories')
class FlowTemplateCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64, unique: true })
  slug: string;                       // "support", "sales", "ecommerce"

  @Column({ type: 'jsonb' })
  name: {                             // Локализованные названия
    ru: string;                       // "Поддержка"
    en: string;                       // "Support"
    pl: string;                       // "Wsparcie"
    de: string;                       // "Support"
    ua: string;                       // "Підтримка"
  };

  @Column({ type: 'jsonb', nullable: true })
  description: {                      // Локализованные описания (опционально)
    ru?: string;
    en?: string;
    pl?: string;
    de?: string;
    ua?: string;
  };

  @Column({ nullable: true })
  icon: string;                       // Emoji или имя иконки Ant Design

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 1.4 Миграция

**Путь:** `backend/src/database/migrations/XXXX-CreateFlowTemplates.ts`

- Таблица `flow_template_categories`
- Таблица `flow_templates` с FK `categoryId → flow_template_categories.id`
- Индексы: `status`, `type`, `authorId`, `categoryId`, `isPlatformChoice`
- GIN-индекс на `tags` для быстрого поиска по тегам

---

## Часть 2: Backend API

### 2.1 Пользовательский API — `FlowTemplatesController`

**Путь:** `backend/src/modules/flow-templates/flow-templates.controller.ts`

**Guard:** `JwtAuthGuard` (авторизованный пользователь)

| Метод  | Путь                                    | Описание                                    |
|--------|-----------------------------------------|---------------------------------------------|
| GET    | `/flow-templates/gallery`               | Галерея: published темплейты + поиск        |
| GET    | `/flow-templates/gallery/:id`           | Детали темплейта из галереи                 |
| GET    | `/flow-templates/my`                    | Мои темплейты (все статусы)                 |
| POST   | `/flow-templates`                       | Создать темплейт из текущего flow           |
| PUT    | `/flow-templates/:id`                   | Обновить свой темплейт (draft/private/rejected)   |
| DELETE | `/flow-templates/:id`                   | Архивировать свой темплейт (только draft/private/rejected) |
| POST   | `/flow-templates/:id/publish`           | Отправить на модерацию (status → pending_review)  |
| POST   | `/flow-templates/:id/request-deletion`  | Запросить удаление published (→ pending_deletion) |
| POST   | `/flow-templates/:id/apply`             | Зафиксировать применение (usageCount++)           |

#### Галерея — `GET /flow-templates/gallery`

**Query параметры:**

```typescript
class GalleryQueryDto {
  search?: string;          // Поиск по name, description, tags
  type?: FlowTemplateType;  // full | partial
  categoryId?: string;      // Фильтр по категории (UUID)
  tags?: string[];          // Фильтр по тегам
  isPlatformChoice?: boolean; // Только "Выбор платформы"
  sortBy?: 'popular' | 'newest' | 'name'; // Сортировка
  page?: number;
  limit?: number;
}
```

**Ответ:**

```typescript
interface GalleryResponse {
  items: FlowTemplateListItem[];
  total: number;
  page: number;
  limit: number;
}

interface FlowTemplateListItem {
  id: string;
  name: string;
  description: string;
  type: FlowTemplateType;
  category: { id: string; slug: string; name: LocalizedString } | null;
  tags: string[];
  isPlatformChoice: boolean;
  usageCount: number;
  nodeCount: number;
  authorName: string | null; // null для системных
  publishedAt: string;
  // flowData НЕ включается в список — только при GET /gallery/:id
}
```

#### Создание темплейта — `POST /flow-templates`

```typescript
class CreateFlowTemplateDto {
  @IsString() @MaxLength(128)
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsEnum(FlowTemplateType)
  type: FlowTemplateType;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsObject()
  flowData: FlowDataDto; // { nodes, edges, viewport }

  @IsOptional() @IsEnum(FlowTemplateStatus)
  initialStatus?: 'draft' | 'private'; // По умолчанию 'draft'
}
```

**Бизнес-правила:**
- `authorId` устанавливается автоматически из JWT
- `nodeCount` вычисляется из `flowData.nodes.length`
- Пользователь может создавать не более 50 темплейтов (лимит)

#### Запрос на удаление — `POST /flow-templates/:id/request-deletion`

```typescript
class RequestDeletionDto {
  @IsOptional() @IsString()
  reason?: string; // Причина запроса на удаление
}
```

**Бизнес-правила:**
- Только для `status = 'published'` (для draft/private/rejected — DELETE → archived)
- Устанавливает `status = 'pending_deletion'`, `deletionRequestReason = reason`
- Темплейт остаётся видимым в галерее до решения админа
- Автор не может редактировать темплейт в статусе `pending_deletion`

### 2.2 Админ API — `AdminFlowTemplatesController`

**Путь:** `backend/src/modules/admin/controllers/admin-flow-templates.controller.ts`

**Guard:** `AdminJwtGuard`, `AdminRolesGuard`

| Метод  | Путь                                       | Описание                                    |
|--------|--------------------------------------------|---------------------------------------------|
| GET    | `/admin/flow-templates`                    | Все темплейты (фильтр по status, type, author) |
| GET    | `/admin/flow-templates/:id`                | Детали темплейта                            |
| POST   | `/admin/flow-templates`                    | Создать системный темплейт (authorId = null) |
| PUT    | `/admin/flow-templates/:id`                | Обновить любой темплейт                     |
| DELETE | `/admin/flow-templates/:id`                | Архивировать любой темплейт                  |
| POST   | `/admin/flow-templates/:id/approve`         | Одобрить публикацию → status = published     |
| POST   | `/admin/flow-templates/:id/reject`          | Отклонить публикацию → status = rejected     |
| POST   | `/admin/flow-templates/:id/approve-deletion`| Одобрить удаление → status = archived        |
| POST   | `/admin/flow-templates/:id/reject-deletion` | Отклонить удаление → status = published      |
| POST   | `/admin/flow-templates/:id/platform-choice` | Установить/снять isPlatformChoice            |
| POST   | `/admin/flow-templates/:id/duplicate`       | Дублировать темплейт                         |

#### Одобрение — `POST /admin/flow-templates/:id/approve`

```typescript
// Только для status = 'pending_review'
// Устанавливает: status = 'published', publishedAt = now()
```

#### Отклонение — `POST /admin/flow-templates/:id/reject`

```typescript
class RejectTemplateDto {
  @IsString()
  reason: string; // Причина отклонения — видна автору
}
// Устанавливает: status = 'rejected', rejectionReason = reason
```

#### Одобрение удаления — `POST /admin/flow-templates/:id/approve-deletion`

```typescript
// Только для status = 'pending_deletion'
// Устанавливает: status = 'archived', archivedAt = now()
// Темплейт скрывается из галереи, но остаётся в БД
```

#### Отклонение удаления — `POST /admin/flow-templates/:id/reject-deletion`

```typescript
class RejectDeletionDto {
  @IsOptional() @IsString()
  reason?: string; // Опциональный комментарий — почему не удаляем
}
// Устанавливает: status = 'published' (возвращает обратно в галерею)
```

#### Пометка "Выбор платформы" — `POST /admin/flow-templates/:id/platform-choice`

```typescript
class PlatformChoiceDto {
  @IsBoolean()
  isPlatformChoice: boolean;
}
// Доступно для любых published темплейтов
// "Выбор платформы" отображаются вверху галереи
```

### 2.3 Админ API категорий — `AdminFlowTemplateCategoriesController`

**Путь:** `backend/src/modules/admin/controllers/admin-flow-template-categories.controller.ts`

| Метод  | Путь                                            | Описание                        |
|--------|------------------------------------------------|----------------------------------|
| GET    | `/admin/flow-template-categories`              | Все категории                    |
| POST   | `/admin/flow-template-categories`              | Создать категорию                |
| PUT    | `/admin/flow-template-categories/:id`          | Обновить категорию               |
| DELETE | `/admin/flow-template-categories/:id`          | Удалить категорию (soft delete)  |

#### Создание/обновление категории

```typescript
class UpsertCategoryDto {
  @IsString() @MaxLength(64)
  slug: string;

  @IsObject()
  name: { ru: string; en: string; pl: string; de: string; ua: string };

  @IsOptional() @IsObject()
  description?: { ru?: string; en?: string; pl?: string; de?: string; ua?: string };

  @IsOptional() @IsString()
  icon?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsInt()
  sortOrder?: number;
}
```

### 2.4 Публичный эндпоинт категорий

| Метод | Путь                              | Описание                             |
|-------|-----------------------------------|--------------------------------------|
| GET   | `/flow-templates/categories`      | Активные категории (для фильтров)    |

Возвращает `FlowTemplateCategory[]` где `isActive = true`, отсортированные по `sortOrder`. Используется в `GalleryFilters` и `SaveAsTemplateModal`.

### 2.5 Модуль

**Путь:** `backend/src/modules/flow-templates/`

```
flow-templates/
├── flow-templates.module.ts
├── flow-templates.controller.ts       # Пользовательский API
├── flow-templates.service.ts          # Бизнес-логика
├── flow-template-categories.service.ts # Логика категорий
├── dto/
│   ├── create-flow-template.dto.ts
│   ├── update-flow-template.dto.ts
│   ├── gallery-query.dto.ts
│   ├── reject-template.dto.ts
│   └── upsert-category.dto.ts
└── flow-template.types.ts             # Enums, interfaces
```

Регистрация в `app.module.ts`:
```typescript
imports: [
  TypeOrmModule.forFeature([FlowTemplate, FlowTemplateCategory]),
  UsersModule, // для authorName
]
```

---

## Часть 3: Логика применения темплейтов

### 3.1 Полный темплейт (type = 'full')

**Поведение:** Полностью заменяет текущий flow.

```
Текущий flow:
  [Start] → [Message A] → [End]

+ Полный темплейт "E-commerce":
  [Start] → [New Message] → [Condition] → [Keyboard] → [API] → [End]

= Результат:
  [Start] → [New Message] → [Condition] → [Keyboard] → [API] → [End]
```

**Алгоритм (фронтенд):**
1. Подтверждение: «Текущий flow будет полностью заменён. Продолжить?»
2. Генерация новых `id` для всех нод и рёбер (избежание коллизий)
3. Обновление ссылок в edges (`source`, `target`) по маппингу старых → новых id
4. `setNodes(newNodes)`, `setEdges(newEdges)`
5. `fitView()` для подгонки viewport

### 3.2 Частичный темплейт (type = 'partial')

**Поведение:** Добавляется к текущему flow, не заменяя существующие ноды.

```
Текущий flow:
  [Start] → [Message A] → [End]

+ Частичный темплейт "FAQ блок":
  [Condition: FAQ?] → [Message: FAQ Answer] → [Keyboard: Rate]

= Результат:
  [Start] → [Message A] → [End]
  [Condition: FAQ?] → [Message: FAQ Answer] → [Keyboard: Rate]
  (новые ноды размещены рядом, не подключены к существующим)
```

**Алгоритм (фронтенд):**
1. Генерация новых `id` для нод и рёбер темплейта
2. Вычисление bounding box текущего flow (max X + отступ)
3. Смещение позиций нод темплейта вправо/вниз от существующих
4. `setNodes([...currentNodes, ...offsettedNewNodes])`
5. `setEdges([...currentEdges, ...newEdges])`
6. Опционально: автоскролл к добавленным нодам

**Алгоритм позиционирования:**
```typescript
function calculateInsertOffset(existingNodes: FlowNode[]): { x: number; y: number } {
  if (existingNodes.length === 0) return { x: 0, y: 0 };

  const maxX = Math.max(...existingNodes.map(n => n.position.x));
  const avgY = existingNodes.reduce((sum, n) => sum + n.position.y, 0) / existingNodes.length;

  return {
    x: maxX + 350, // Отступ 350px вправо от крайней правой ноды
    y: avgY,        // По средней Y существующих нод
  };
}
```

---

## Часть 4: Frontend — Компоненты

### 4.1 Сервис `flowTemplatesService.ts`

**Путь:** `frontend/src/services/flowTemplatesService.ts`

```typescript
export const flowTemplatesService = {
  // Галерея
  getGallery: (params: GalleryQuery) =>
    api.get<GalleryResponse>('/flow-templates/gallery', { params }),
  getGalleryItem: (id: string) =>
    api.get<FlowTemplate>(`/flow-templates/gallery/${id}`),
  getCategories: () =>
    api.get<FlowTemplateCategory[]>('/flow-templates/categories'),

  // Мои темплейты
  getMy: () =>
    api.get<FlowTemplate[]>('/flow-templates/my'),
  create: (data: CreateFlowTemplateDto) =>
    api.post<FlowTemplate>('/flow-templates', data),
  update: (id: string, data: UpdateFlowTemplateDto) =>
    api.put<FlowTemplate>(`/flow-templates/${id}`, data),
  archive: (id: string) =>
    api.delete(`/flow-templates/${id}`),
  publish: (id: string) =>
    api.post(`/flow-templates/${id}/publish`),
  requestDeletion: (id: string, reason?: string) =>
    api.post(`/flow-templates/${id}/request-deletion`, { reason }),
  trackApply: (id: string) =>
    api.post(`/flow-templates/${id}/apply`),
};
```

### 4.2 `TemplateGallery` — Главный компонент галереи

**Путь:** `frontend/src/components/FlowBuilder/TemplateGallery/TemplateGallery.tsx`

**Структура:**

```
TemplateGallery/
├── TemplateGallery.tsx          # Drawer/Modal с галереей
├── TemplateGallery.module.scss
├── GalleryFilters.tsx           # Поиск + фильтры (тип, категория, теги)
├── TemplateCard.tsx             # Карточка темплейта в списке
├── TemplatePreview.tsx          # Модалка предпросмотра (мини ReactFlow readonly)
└── SaveAsTemplateModal.tsx      # Модалка сохранения текущего flow
```

**UI — `TemplateGallery`:**
```
┌─ Галерея шаблонов ────────────────────────────────────────────┐
│                                                                │
│  [🔍 Поиск...]  [Тип ▾] [Категория ▾] [Выбор платформы ☐]   │
│                                                                │
│  Tabs: [Галерея] [Мои темплейты]                               │
│                                                                │
│  ★ Выбор платформы                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ E-commerce   │ │ Поддержка    │ │ Бронирование │           │
│  │ Full • 12 нод│ │ Partial • 5  │ │ Full • 8 нод │           │
│  │ 234 исп.     │ │ 189 исп.     │ │ 156 исп.     │           │
│  │ [Превью]     │ │ [Превью]     │ │ [Превью]     │           │
│  │ [Применить]  │ │ [Добавить]   │ │ [Применить]  │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                │
│  Все темплейты                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ ...          │ │ ...          │ │ ...          │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                │
│  [← 1 2 3 ... →]                                              │
└────────────────────────────────────────────────────────────────┘
```

**TemplateCard** — карточка темплейта:
- Название, описание (truncated)
- Бейджи: тип (`Full` — синий, `Partial` — зелёный), категория, isPlatformChoice (★)
- Кол-во нод, кол-во использований
- Автор (или "Системный")
- Кнопка «Превью» → открывает `TemplatePreview`
- Кнопка «Применить» (full) / «Добавить в flow» (partial)

**TemplatePreview** — предпросмотр:
- ReactFlow в readonly-режиме (`nodesDraggable={false}`, `nodesConnectable={false}`)
- Отображает `flowData` темплейта
- Описание, теги, статистика
- Кнопка «Применить»

### 4.3 `SaveAsTemplateModal` — Сохранение как темплейт

**Открывается из:** FlowToolbar (новая кнопка «Сохранить как темплейт»)

**Поля формы:**
- `name` — название (обязательное)
- `description` — описание (textarea)
- `type` — Full / Partial (radio)
- `category` — выбор из списка или ввод новой
- `tags` — теги (Select mode="tags")
- `initialStatus` — «Сохранить приватно» / «Сохранить как черновик»

**Логика:**
1. `flowData` берётся из текущего состояния FlowBuilder
2. POST `/flow-templates` с заполненными данными
3. Успех → notification + опция «Опубликовать в галерею?»

### 4.4 Интеграция в FlowBuilder

**Изменения в `FlowToolbar.tsx`:**
- Новая кнопка «Галерея шаблонов» (иконка: AppstoreOutlined) — открывает `TemplateGallery`
- Новая кнопка «Сохранить как темплейт» (иконка: SaveOutlined) — открывает `SaveAsTemplateModal`

**Изменения в `FlowBuilder.tsx`:**
- State: `galleryOpen`, `saveTemplateOpen`
- Callback `handleApplyTemplate(template: FlowTemplate)`:
  - Если `template.type === 'full'`:
    - Confirm → заменить flow
    - Генерация новых id → setNodes, setEdges → fitView
  - Если `template.type === 'partial'`:
    - Рассчитать offset → добавить ноды/рёбра → скролл к новым
  - POST `/flow-templates/:id/apply` (учёт использования)

**Рефакторинг `PresetSelector`:**
- `PresetSelector` и `flowPresets/` удаляются сразу — галерея полностью заменяет их
- Новые системные шаблоны создаются позже через админ-панель

### 4.5 Вкладка «Мои темплейты»

В `TemplateGallery` — вторая вкладка:

```
┌─ Мои темплейты ───────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Мой FAQ бот          Draft     [Ред.] [Удал.] [Опубл.]  │  │
│  │ Partial • 5 нод • Создан 10.02.2025                      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ E-commerce flow      Published [Ред.] [Запрос удал.]     │  │
│  │ Full • 15 нод • 42 исп. • Опубликован 05.02.2025        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Старый flow          PendingDel                          │  │
│  │ Full • 6 нод • Ожидает решения админа                    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Тестовый flow        Rejected  [Ред.] [Удал.] [Повт.]   │  │
│  │ Full • 8 нод • Причина: "Дублирует существующий"         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Статусы:                                                      │
│  Draft — черновик, только вы видите                             │
│  Private — сохранён, только вы видите                          │
│  Pending — на модерации                                        │
│  Published — опубликован в галерее                              │
│  Rejected — отклонён (можно отредактировать и отправить снова) │
│  PendingDel — запрос на удаление, ожидает решения админа       │
└────────────────────────────────────────────────────────────────┘
```

---

## Часть 5: Админ-панель

### 5.1 Frontend — `AdminFlowTemplatesPage`

**Путь:** `frontend/src/pages/Admin/FlowTemplates/AdminFlowTemplatesPage.tsx`

**Таблица:**

| Колонка          | Описание                                      |
|------------------|-----------------------------------------------|
| Название         | name + isPlatformChoice badge                 |
| Тип              | full / partial badge                          |
| Категория        | category.name (локализованное)                  |
| Статус           | draft / private / pending / published / rejected / pending_deletion / archived |
| Автор            | authorName или "Системный"                    |
| Ноды             | nodeCount                                      |
| Использований    | usageCount                                     |
| Дата             | createdAt / publishedAt                        |
| Действия         | Просмотр, Ред., Удал., Одобрить/Отклонить     |

**Фильтры:**
- Поиск по названию
- Фильтр по статусу (с акцентом на `pending_review` — бейдж с количеством)
- Фильтр по типу
- Фильтр по категории

**Функции:**
- Создание системного темплейта (с встроенным FlowEditor — переиспользуем `FlowBuilder` в режиме редактирования)
- Пометка «Выбор платформы» — toggle в строке или в детальном просмотре
- Одобрение/Отклонение — кнопки в строке для `pending_review` темплейтов
- При отклонении — модалка с полем ввода причины

### 5.2 Frontend — `AdminFlowTemplateCategoriesPage`

**Путь:** `frontend/src/pages/Admin/FlowTemplateCategories/AdminFlowTemplateCategoriesPage.tsx`

**Таблица:**

| Колонка      | Описание                                |
|--------------|----------------------------------------|
| Иконка       | icon (emoji / Ant Design icon)         |
| Slug         | slug                                    |
| Название     | name по текущему языку админки          |
| Статус       | isActive toggle                         |
| Порядок      | sortOrder (drag & drop или input)       |
| Действия     | Ред., Удал.                             |

**Модалка создания/редактирования:**
- `slug` — уникальный идентификатор (автогенерация из ru-названия, редактируемый)
- `icon` — выбор emoji или иконки
- `name` — 5 полей ввода по языкам (ru, en, pl, de, ua), с табами или вертикальным списком
- `description` — 5 полей ввода по языкам (опционально)
- `isActive` — switch
- `sortOrder` — число

### 5.3 Админ API в `adminApi.ts`

```typescript
export const flowTemplatesAdminApi = {
  getAll: (params?) =>
    adminFetch<PaginatedResponse<FlowTemplate>>('/admin/flow-templates', params),
  getById: (id: string) =>
    adminFetch<FlowTemplate>(`/admin/flow-templates/${id}`),
  create: (data: CreateFlowTemplateDto) =>
    adminFetch<FlowTemplate>('/admin/flow-templates', { method: 'POST', body: data }),
  update: (id: string, data: UpdateFlowTemplateDto) =>
    adminFetch<FlowTemplate>(`/admin/flow-templates/${id}`, { method: 'PUT', body: data }),
  archive: (id: string) =>
    adminFetch(`/admin/flow-templates/${id}`, { method: 'DELETE' }),
  approve: (id: string) =>
    adminFetch(`/admin/flow-templates/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) =>
    adminFetch(`/admin/flow-templates/${id}/reject`, { method: 'POST', body: { reason } }),
  approveDeletion: (id: string) =>
    adminFetch(`/admin/flow-templates/${id}/approve-deletion`, { method: 'POST' }),
  rejectDeletion: (id: string, reason?: string) =>
    adminFetch(`/admin/flow-templates/${id}/reject-deletion`, { method: 'POST', body: { reason } }),
  setPlatformChoice: (id: string, isPlatformChoice: boolean) =>
    adminFetch(`/admin/flow-templates/${id}/platform-choice`, {
      method: 'POST', body: { isPlatformChoice }
    }),
  duplicate: (id: string) =>
    adminFetch<FlowTemplate>(`/admin/flow-templates/${id}/duplicate`, { method: 'POST' }),
};

export const flowTemplateCategoriesAdminApi = {
  getAll: () =>
    adminFetch<FlowTemplateCategory[]>('/admin/flow-template-categories'),
  create: (data: UpsertCategoryDto) =>
    adminFetch<FlowTemplateCategory>('/admin/flow-template-categories', { method: 'POST', body: data }),
  update: (id: string, data: UpsertCategoryDto) =>
    adminFetch<FlowTemplateCategory>(`/admin/flow-template-categories/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) =>
    adminFetch(`/admin/flow-template-categories/${id}`, { method: 'DELETE' }),
};
```

---

## Часть 6: Связь с PLAN_SMART_SETUP и удаление пресетов

### 6.1 Удаление существующих пресетов

Текущие 18 локальных пресетов (`frontend/src/flowPresets/`) удаляются полностью:
- Удалить директорию `frontend/src/flowPresets/`
- Удалить компонент `PresetSelector` и его импорты из `FlowBuilder` / `FlowToolbar`
- Новые системные шаблоны создаются позже через админ-панель

### 6.2 Связь с PLAN_SMART_SETUP

`FlowTemplate` **заменяет** `FlowPreset` из PLAN_SMART_SETUP:
- `OnboardingTemplate.flowPresetIds` → ссылается на `FlowTemplate.id` вместо `FlowPreset.id`
- Entity `FlowPreset` не создаётся — используется `FlowTemplate` с `status = 'published'`
- Публичный эндпоинт для PresetSelector (Часть 3.3 PLAN_SMART_SETUP) заменяется API галереи

---

## Часть 7: Безопасность и валидация

### 7.1 Права доступа

| Действие                         | Кто может                        |
|----------------------------------|----------------------------------|
| Просмотр галереи                 | Любой авторизованный пользователь|
| Создание темплейта               | Любой авторизованный пользователь|
| Редактирование темплейта         | Только автор (или админ)         |
| Удаление темплейта (draft/private/rejected) | Только автор (или админ) |
| Запрос на удаление (published)   | Только автор                     |
| Отправка на модерацию            | Только автор                     |
| Одобрение/Отклонение публикации  | Только админ                     |
| Одобрение/Отклонение удаления    | Только админ                     |
| Пометка "Выбор платформы"        | Только админ                     |
| Создание системного темплейта    | Только админ                     |

### 7.2 Валидация `flowData`

При создании/обновлении темплейта:
- `nodes` — массив, непустой (минимум 1 нода)
- Каждая нода: `id` (string), `type` (валидный FlowNodeType), `position` ({x, y}), `data` (object)
- `edges` — массив (может быть пустой)
- Каждый edge: `source` и `target` ссылаются на существующие `node.id`
- Максимальный размер `flowData` JSON: 5 MB

### 7.3 Rate limits

- Создание темплейтов: 10 в час на пользователя
- Отправка на модерацию: 5 в час на пользователя

---

## Часть 8: Уведомления автору

При изменении статуса темплейта автор получает in-app уведомление.

### 8.1 Триггеры уведомлений

| Событие                          | Получатель | Текст (ru)                                                    |
|----------------------------------|------------|---------------------------------------------------------------|
| Темплейт опубликован (approved)  | Автор      | «Ваш шаблон "{{name}}" одобрен и опубликован в галерее»       |
| Темплейт отклонён (rejected)     | Автор      | «Ваш шаблон "{{name}}" отклонён. Причина: {{reason}}»         |
| Удаление одобрено (archived)     | Автор      | «Ваш запрос на удаление шаблона "{{name}}" одобрен»            |
| Удаление отклонено               | Автор      | «Запрос на удаление шаблона "{{name}}" отклонён»               |
| Новый pending_review             | Админ      | «Новый шаблон на модерацию: "{{name}}" от {{authorName}}»      |
| Новый pending_deletion           | Админ      | «Запрос на удаление шаблона "{{name}}" от {{authorName}}»      |

### 8.2 Реализация

Используется существующий механизм уведомлений проекта (если есть NotificationsModule) или EventEmitter:

```typescript
// В FlowTemplatesService после смены статуса:
this.eventEmitter.emit('flow-template.status-changed', {
  templateId: template.id,
  templateName: template.name,
  authorId: template.authorId,
  oldStatus,
  newStatus,
  reason, // rejectionReason или deletionRequestReason
});
```

Listener создаёт запись уведомления и отправляет через WebSocket (если пользователь онлайн).

---

## Часть 9: Порядок внедрения

### 9.1 Этап 1 — Backend
- Entity `FlowTemplateCategory` + `FlowTemplate` + миграция
- `FlowTemplatesModule` (controller, service, DTOs, categories)
- `AdminFlowTemplatesController` + `AdminFlowTemplateCategoriesController`

### 9.2 Этап 2 — Frontend: удаление старого + галерея
- Удалить `flowPresets/`, `PresetSelector`
- Компонент `TemplateGallery` + интеграция в `FlowBuilder`
- `SaveAsTemplateModal`

### 9.3 Этап 3 — Админ-панель
- `AdminFlowTemplateCategoriesPage` — справочник категорий с i18n
- `AdminFlowTemplatesPage` — управление, верификация, создание системных шаблонов
- Создание начальных категорий и первых системных шаблонов через админку

### 9.4 Этап 4 — Уведомления
- Уведомления автору при approve/reject
- Уведомления админу при pending_review/pending_deletion

---

## Поток данных

```
Пользователь создаёт flow в редакторе
         │
         ▼
  "Сохранить как темплейт"
         │
         ▼
  POST /flow-templates
  { name, description, type, category, tags, flowData }
         │
         ▼
  flow_templates (status: draft/private)
         │
         ▼
  "Опубликовать в галерею"
         │
         ▼
  POST /flow-templates/:id/publish
  (status → pending_review)
         │
         ▼
  Админ: GET /admin/flow-templates?status=pending_review
         │
    ┌────┴────┐
    ▼         ▼
 Approve   Reject
    │         │
    ▼         ▼
 published  rejected
    │       (автор видит причину,
    ▼        может исправить и
 Галерея    переотправить)
    │
    ▼
 Другой пользователь:
 GET /flow-templates/gallery
         │
         ▼
  "Применить" / "Добавить в flow"
         │
    ┌────┴────┐
    ▼         ▼
  Full     Partial
    │         │
    ▼         ▼
 Заменить  Добавить рядом
 весь flow  с offset
```
