# 📋 План доработки админ-панели BotManager

> **Дата:** Январь 2026  
> **Статус:** Планирование  
> **Приоритет:** Высокий

---

## 📊 Текущее состояние

### ✅ Backend (полностью реализован)

| Контроллер | Функционал |
|------------|-----------|
| `admin-auth` | Авторизация, 2FA, управление админами, ротация паролей |
| `admin-users` | CRUD пользователей, блокировка/разблокировка, статистика |
| `admin-bots` | CRUD ботов, управление flows, статистика |
| `admin-shops` | CRUD магазинов, статистика |
| `admin-orders` | CRUD заказов, отмена, статистика |
| `admin-leads` | CRUD лидов, статистика |
| `admin-logs` | Просмотр логов, фильтрация, статистика |
| `admin-dashboard` | Общая статистика, графики |
| `admin-redeploy` | Управление редеплоем, субдомены |

### Frontend (в основном реализован)

| Страница | Статус |
|----------|--------|
| `AdminLoginPage` | ✅ Готово |
| `AdminDashboardPage` | ✅ Готово |
| `AdminUsersPage` | ✅ Базовый (просмотр, блокировка) |
| `AdminRoutingPage` | ✅ Готово |
| `AdminBotsPage` | ✅ Готово (Этап 1) |
| `AdminShopsPage` | ✅ Готово (Этап 1) |
| `AdminOrdersPage` | ✅ Готово (Этап 1) |
| `AdminLeadsPage` | ✅ Готово (Этап 1) |
| `AdminLogsPage` | ✅ Готово (Этап 1) |
| `AdminAdminsPage` | ❌ **Заглушка** |
| `AdminSettingsPage` | ❌ **Заглушка** |

---

## 🎯 Система ролей и прав доступа

### Текущие роли:
```typescript
enum AdminRole {
  SUPERADMIN = "superadmin",  // Полный доступ + управление админами
  SUPPORT = "support",        // Доступ ко всем сущностям для поддержки
  VIEWER = "viewer",          // Только просмотр (для аналитики)
}
```

### 📌 Матрица прав:

| Действие | SUPERADMIN | SUPPORT | VIEWER |
|----------|------------|---------|--------|
| Просмотр данных | ✅ | ✅ | ✅ |
| Редактирование сущностей | ✅ | ✅ | ❌ |
| Удаление сущностей | ✅ | ⚠️ (с подтверждением) | ❌ |
| Управление админами | ✅ | ❌ | ❌ |
| Системные настройки | ✅ | ❌ | ❌ |
| Триггер редеплоя | ✅ | ✅ | ❌ |

---

## 🔄 Стратегия переиспользования компонентов

### Ключевое решение

**Вместо создания дублирующих компонентов для админки, переиспользуем существующие компоненты пользовательского интерфейса** с минимальными модификациями.

### Доступные компоненты для переиспользования

| Компонент | Расположение | Функционал |
|-----------|--------------|------------|
| `OrdersTable` | `components/OrdersTable` | Таблица заказов с фильтрами, редактированием статуса, данных покупателя |
| `ProductsTable` | `components/ProductsTable` | Таблица товаров с CRUD |
| `CategoriesTab` | `components/CategoriesTab` | Управление категориями |
| `CartsTable` | `components/CartsTable` | Просмотр активных корзин |
| `PromocodesTab` | `components/PromocodesTab` | Управление промокодами |
| `DialogsTable` | `components/DialogsTable` | Таблица диалогов |
| `MessagesTable` | `components/MessagesTable` | Таблица сообщений |
| `BroadcastTab` | `components/BroadcastTab` | Рассылки |
| `FlowBuilder` | `components/FlowBuilder` | Конструктор flow |
| `BotPermissionsTable` | `components/BotPermissionsTable` | Таблица прав бота |
| `ShopSettingsComponent` | `components/ShopSettings` | Полный набор настроек магазина |
| `BookingSystemSettings` | `components/BookingSystemSettings` | Настройки системы бронирования |
| `CustomPagesManager` | `components/CustomPagesManager` | Управление кастомными страницами |

### Архитектура переиспользования

```
┌─────────────────────────────────────────────────────────────────┐
│                    ПОЛЬЗОВАТЕЛЬСКИЙ ИНТЕРФЕЙС                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ ShopDetails │  │ BotDetails  │  │ LeadsPage   │   ...        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ПЕРЕИСПОЛЬЗУЕМЫЕ КОМПОНЕНТЫ                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ OrdersTable │  │ FlowBuilder │  │ LeadsTable  │   ...        │
│  │  + isAdmin  │  │  + isAdmin  │  │  + isAdmin  │              │
│  │  + readOnly │  │  + readOnly │  │  + readOnly │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      АДМИН-ПАНЕЛЬ                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │AdminOrders  │  │ AdminBots   │  │ AdminLeads  │   ...        │
│  │   Page      │  │   Page      │  │   Page      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Необходимые модификации компонентов

#### 1. Добавить общие пропсы для режима админа

```typescript
// Общий интерфейс для админского режима
interface AdminModeProps {
  isAdmin?: boolean;           // Режим админа (использует admin API)
  readOnly?: boolean;          // Только просмотр (для роли viewer)
  onAdminAction?: (action: AdminAction) => void;  // Callback для логирования
  entityOwnerId?: string;      // ID владельца сущности (для контекста)
}

// Пример расширения OrdersTable
interface OrdersTableProps extends AdminModeProps {
  shopId: string;
  linkedBotId?: string;
}
```

#### 2. Условное использование API

```typescript
// В компоненте OrdersTable
const { data: ordersData, isLoading } = useQuery(
  ["orders", shopId, isAdmin],
  async () => {
    if (isAdmin) {
      // Используем админский API
      return adminOrdersApi.getAll({ shopId, ...filters });
    }
    // Используем пользовательский API
    return shopsService.getOrders(shopId, filters);
  }
);
```

#### 3. Условный рендеринг кнопок

```typescript
// В компоненте
{!readOnly && (
  <Button onClick={handleEdit}>Редактировать</Button>
)}
```

---

## 📝 Детальный план доработок

### Фаза 1: Подготовка инфраструктуры

#### 1.1 Создать хук `useAdminPermissions`

**Файл:** `frontend/src/hooks/useAdminPermissions.ts`

```typescript
import { useAdminStore } from "@/store/adminStore";

export const useAdminPermissions = () => {
  const { admin } = useAdminStore();
  
  return {
    canEdit: admin?.role !== 'viewer',
    canDelete: admin?.role === 'superadmin',
    canManageAdmins: admin?.role === 'superadmin',
    canImpersonate: ['superadmin', 'support'].includes(admin?.role || ''),
    canTriggerRedeploy: admin?.role !== 'viewer',
    isAdmin: true,
    role: admin?.role,
  };
};
```

#### 1.2 Создать компонент `AdminPermissionGate`

**Файл:** `frontend/src/components/AdminPermissionGate/AdminPermissionGate.tsx`

```typescript
interface Props {
  permission: 'edit' | 'delete' | 'manageAdmins' | 'impersonate';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdminPermissionGate: React.FC<Props> = ({ 
  permission, 
  children, 
  fallback = null 
}) => {
  const permissions = useAdminPermissions();
  const permissionKey = `can${permission.charAt(0).toUpperCase() + permission.slice(1)}`;
  const hasPermission = permissions[permissionKey as keyof typeof permissions];
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
};
```

#### 1.3 Создать обёртку для API

**Файл:** `frontend/src/hooks/useEntityApi.ts`

```typescript
// Хук для автоматического выбора API в зависимости от контекста
export const useEntityApi = <T>(entityType: 'orders' | 'products' | 'leads' | ...) => {
  const isAdmin = useAdminContext(); // или из props
  
  const api = useMemo(() => {
    if (isAdmin) {
      return adminApis[entityType];
    }
    return userApis[entityType];
  }, [isAdmin, entityType]);
  
  return api;
};
```

---

### Фаза 2: Модификация существующих компонентов

#### 2.1 Модификация `OrdersTable`

**Изменения:**
1. Добавить пропсы `isAdmin`, `readOnly`
2. Условное использование API
3. Скрытие кнопок редактирования для `readOnly`
4. Добавить колонку "Магазин" для админского режима

```typescript
// OrdersTable.tsx
interface OrdersTableProps {
  shopId?: string;           // Опционально для админки (показывает все заказы)
  linkedBotId?: string;
  isAdmin?: boolean;         // НОВОЕ
  readOnly?: boolean;        // НОВОЕ
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  shopId,
  linkedBotId,
  isAdmin = false,
  readOnly = false,
}) => {
  // Выбор API
  const ordersApi = isAdmin ? adminOrdersApi : shopsService;
  
  // Загрузка данных
  const { data: ordersData } = useQuery(
    [isAdmin ? "admin-orders" : "shop-orders", shopId],
    () => isAdmin 
      ? ordersApi.getAll({ shopId }) 
      : ordersApi.getOrders(shopId!, {}),
  );
  
  // Колонки - добавляем "Магазин" для админа
  const columns = useMemo(() => {
    const baseColumns = [...existingColumns];
    
    if (isAdmin && !shopId) {
      baseColumns.unshift({
        title: "Магазин",
        dataIndex: ["shop", "name"],
        key: "shop",
      });
    }
    
    // Убираем действия для readOnly
    if (readOnly) {
      return baseColumns.filter(col => col.key !== 'actions');
    }
    
    return baseColumns;
  }, [isAdmin, shopId, readOnly]);
  
  // ...
};
```

#### 2.2 Аналогичные изменения для других компонентов

- `ProductsTable` → добавить `isAdmin`, `readOnly`
- `CategoriesTab` → добавить `isAdmin`, `readOnly`
- `CartsTable` → добавить `isAdmin`, `readOnly`
- `PromocodesTab` → добавить `isAdmin`, `readOnly`
- `FlowBuilder` → добавить `isAdmin`, `readOnly`
- `DialogsTable` → добавить `isAdmin`, `readOnly`

---

### Фаза 3: Создание страниц админки

#### 3.1 `AdminBotsPage`

**Файл:** `frontend/src/pages/Admin/Bots/AdminBotsPage.tsx`

**Подход:** Создать страницу-обёртку, которая:
1. Загружает список ботов через `adminApi`
2. При выборе бота показывает детали в Drawer
3. Переиспользует `FlowBuilder`, `DialogsTable`, `MessagesTable` с `isAdmin=true`

```typescript
export const AdminBotsPage: React.FC = () => {
  const { canEdit } = useAdminPermissions();
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  
  return (
    <div>
      {/* Список ботов */}
      <BotsTable 
        isAdmin 
        readOnly={!canEdit}
        onSelect={setSelectedBot}
      />
      
      {/* Drawer с деталями */}
      <Drawer open={!!selectedBot} width={800}>
        <Tabs>
          <TabPane tab="Flows">
            <FlowBuilder botId={selectedBot?.id} isAdmin readOnly={!canEdit} />
          </TabPane>
          <TabPane tab="Диалоги">
            <DialogsTable botId={selectedBot?.id} isAdmin readOnly={!canEdit} />
          </TabPane>
          {/* ... */}
        </Tabs>
      </Drawer>
    </div>
  );
};
```

#### 3.2 `AdminShopsPage`

**Подход:** Переиспользовать `ShopSettingsComponent` с модификациями

```typescript
export const AdminShopsPage: React.FC = () => {
  const { canEdit } = useAdminPermissions();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  
  return (
    <div>
      {/* Список магазинов */}
      <ShopsTable isAdmin onSelect={setSelectedShop} />
      
      {/* Drawer с настройками */}
      <Drawer open={!!selectedShop} width={1000}>
        {/* Переиспользуем ShopSettingsComponent */}
        <ShopSettingsComponent 
          shopId={selectedShop?.id!}
          isAdmin
          readOnly={!canEdit}
        />
      </Drawer>
    </div>
  );
};
```

#### 3.3 `AdminOrdersPage`

**Подход:** Переиспользовать `OrdersTable` напрямую

```typescript
export const AdminOrdersPage: React.FC = () => {
  const { canEdit } = useAdminPermissions();
  
  return (
    <div className={styles.container}>
      <Title level={2}>Заказы</Title>
      
      {/* Дополнительные фильтры для админки */}
      <AdminOrdersFilters />
      
      {/* Переиспользуем OrdersTable без shopId - показывает все заказы */}
      <OrdersTable 
        isAdmin 
        readOnly={!canEdit}
      />
    </div>
  );
};
```

#### 3.4 `AdminLeadsPage`

```typescript
export const AdminLeadsPage: React.FC = () => {
  const { canEdit } = useAdminPermissions();
  
  return (
    <div>
      <LeadsTable isAdmin readOnly={!canEdit} />
    </div>
  );
};
```

#### 3.5 `AdminLogsPage`

**Новый компонент** - нет аналога в пользовательском интерфейсе

```typescript
export const AdminLogsPage: React.FC = () => {
  // Фильтры
  const [filters, setFilters] = useState({
    adminId: undefined,
    actionType: undefined,
    entityType: undefined,
    level: undefined,
    startDate: undefined,
    endDate: undefined,
  });
  
  const { data, isLoading } = useQuery(
    ["admin-logs", filters],
    () => logsApi.getAll(filters)
  );
  
  return (
    <div>
      <AdminLogsFilters value={filters} onChange={setFilters} />
      <AdminLogsTable data={data} loading={isLoading} />
      <AdminLogDetailsModal />
    </div>
  );
};
```

#### 3.6 `AdminAdminsPage`

**Новый компонент** - доступен только для `SUPERADMIN`

```typescript
export const AdminAdminsPage: React.FC = () => {
  // Полностью новая страница для управления администраторами
  return (
    <div>
      <AdminsTable />
      <CreateAdminModal />
      <EditAdminModal />
      <PasswordRotationSettings />
    </div>
  );
};
```

#### 3.7 `AdminSettingsPage`

```typescript
export const AdminSettingsPage: React.FC = () => {
  return (
    <Tabs>
      <TabPane tab="Профиль" key="profile">
        <AdminProfileTab />
      </TabPane>
      <TabPane tab="Безопасность" key="security">
        <AdminSecurityTab />  {/* 2FA, смена пароля */}
      </TabPane>
    </Tabs>
  );
};
```

---

### Фаза 4: Расширение API для специфичных админских функций

#### 4.1 Новые endpoints (если нужны)

```typescript
// admin-products.controller.ts - если нужно управление товарами глобально
@Controller("admin/products")
- GET /admin/products - все товары всех магазинов
- GET /admin/products/:id
- PUT /admin/products/:id
- DELETE /admin/products/:id

// admin-booking.controller.ts
@Controller("admin/booking-systems")
- GET /admin/booking-systems
- GET /admin/booking-systems/:id
- PUT /admin/booking-systems/:id
- GET /admin/booking-systems/:id/bookings
- PUT /admin/bookings/:id
```

---

## 📅 Приоритеты и очерёдность реализации

### ✅ Высокий приоритет (Этап 1 - ВЫПОЛНЕНО)

1. **Инфраструктура:**
   - [x] `useAdminPermissions` хук
   - [x] `AdminPermissionGate` компонент
   - [x] Модификация `adminApi.ts`

2. **Модификация компонентов:**
   - [x] `OrdersTable` + `isAdmin`, `readOnly`

3. **Страницы:**
   - [x] `AdminOrdersPage` (критично для поддержки)
   - [x] `AdminLogsPage` (критично для аудита)
   - [x] `AdminBotsPage`
   - [x] `AdminShopsPage`
   - [x] `AdminLeadsPage`

### 🟡 Средний приоритет (Этап 2 - 2-3 недели)

4. **Модификация компонентов:**
   - [ ] `ProductsTable` + `isAdmin`, `readOnly`
   - [ ] `CategoriesTab` + `isAdmin`, `readOnly`
   - [ ] `CartsTable` + `isAdmin`, `readOnly`
   - [ ] `FlowBuilder` + `isAdmin`, `readOnly`
   - [ ] `DialogsTable` + `isAdmin`, `readOnly`

### 🟢 Низкий приоритет (Этап 3 - 1-2 недели)

6. **Страницы:**
   - [ ] `AdminAdminsPage`
   - [ ] `AdminSettingsPage`

7. **Дополнительно:**
   - [ ] Режим "Импersонация" (вход от имени пользователя)
   - [ ] Расширенная аналитика на дашборде
   - [ ] Экспорт данных

---

## 🏗️ Итоговая структура файлов

```
frontend/src/
├── components/
│   ├── AdminPermissionGate/
│   │   ├── AdminPermissionGate.tsx
│   │   └── index.ts
│   ├── OrdersTable/
│   │   └── OrdersTable.tsx          # + isAdmin, readOnly props
│   ├── ProductsTable/
│   │   └── ProductsTable.tsx        # + isAdmin, readOnly props
│   └── ...                          # другие модифицированные компоненты
│
├── hooks/
│   ├── useAdminPermissions.ts       # НОВЫЙ
│   └── useEntityApi.ts              # НОВЫЙ (опционально)
│
├── pages/
│   └── Admin/
│       ├── Bots/
│       │   ├── AdminBotsPage.tsx    # Переиспользует FlowBuilder, DialogsTable
│       │   └── index.ts
│       ├── Shops/
│       │   ├── AdminShopsPage.tsx   # Переиспользует ShopSettingsComponent
│       │   └── index.ts
│       ├── Orders/
│       │   ├── AdminOrdersPage.tsx  # Переиспользует OrdersTable
│       │   └── index.ts
│       ├── Leads/
│       │   ├── AdminLeadsPage.tsx
│       │   └── index.ts
│       ├── Logs/
│       │   ├── AdminLogsPage.tsx    # Новый компонент
│       │   ├── AdminLogsFilters.tsx
│       │   ├── AdminLogDetailsModal.tsx
│       │   └── index.ts
│       ├── Admins/
│       │   ├── AdminAdminsPage.tsx  # Новый компонент
│       │   └── index.ts
│       └── Settings/
│           ├── AdminSettingsPage.tsx
│           └── index.ts
│
└── services/
    └── adminApi.ts                   # Уже существует, возможно расширить
```

---

## 💡 Ключевые принципы

1. **DRY (Don't Repeat Yourself):**
   - Максимальное переиспользование существующих компонентов
   - Добавление пропсов `isAdmin`, `readOnly` вместо дублирования кода

2. **Постепенная миграция:**
   - Компоненты остаются обратно совместимыми
   - `isAdmin=false` по умолчанию - существующий функционал не ломается

3. **Разделение ответственности:**
   - Компоненты не знают о бизнес-логике прав
   - `useAdminPermissions` централизует логику доступа

4. **Аудит:**
   - Все действия админа логируются через существующий `AdminActionLogService`
   - Компоненты вызывают `onAdminAction` callback при изменениях

---

## 📌 Примечания

- Backend API уже полностью готов - работа только на фронтенде
- Все методы API определены в `adminApi.ts`
- Существующие компоненты покрывают ~80% требуемого функционала
- Новые компоненты нужны только для: Логов, Управления админами, Настроек профиля

