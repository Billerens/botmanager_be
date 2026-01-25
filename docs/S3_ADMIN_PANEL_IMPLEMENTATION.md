# План реализации вкладки "S3" для админ-панели

## Цель
Добавить в админ-панель вкладку "S3" для мониторинга и управления состоянием хранилища с возможностью просмотра деталей связанных сущностей.

## Этапы реализации

### ✅ Этап 1: Backend - Расширение S3Service
**Статус:** ✅ Завершен  
**Файл:** `backend/src/common/s3.service.ts`

**Задачи:**
- [x] Добавить метод `listFiles(prefix?: string, maxKeys?: number)` для получения списка файлов
- [x] Добавить метод `getStorageStats()` для получения статистики по папкам
- [x] Добавить метод `getFileMetadata(fileUrl: string)` для получения метаданных файла
- [x] Использовать `ListObjectsV2Command` из `@aws-sdk/client-s3`

---

### ✅ Этап 2: Backend - AdminS3Service
**Статус:** ✅ Завершен  
**Файл:** `backend/src/modules/admin/services/admin-s3.service.ts`

**Задачи:**
- [x] Создать сервис для работы с S3 в контексте админ-панели
- [x] Реализовать получение списка файлов с пагинацией
- [x] Реализовать статистику по папкам (количество, размер)
- [x] Реализовать определение связанной сущности по пути файла
- [x] Реализовать поиск файлов по связанной сущности (shopId, customPageId, productId)

**Связанные сущности:**
- Shop: `logoUrl` → поиск по `shop-logos/{uuid}.webp`
- CustomPage: `assets[].s3Key` → поиск по `custom-pages/{pageId}/*`
- Product: `images[]` → поиск по `products/{uuid}.webp`
- Category: изображения → поиск по `category-images/{uuid}.webp`
- BookingSystem: логотипы → поиск по `booking-logos/{uuid}.webp`
- Message: изображения → поиск по `message-images/{uuid}.webp`
- Specialist: аватары → поиск по `specialist-avatars/{uuid}.webp`
- Service: изображения → поиск по `service-images/{uuid}.webp`

---

### ✅ Этап 3: Backend - AdminS3Controller
**Статус:** ✅ Завершен  
**Файл:** `backend/src/modules/admin/controllers/admin-s3.controller.ts`

**Задачи:**
- [x] Создать контроллер с эндпоинтами:
  - `GET /admin/s3/files` - список файлов с пагинацией и фильтрами
  - `GET /admin/s3/stats` - статистика хранилища
  - `GET /admin/s3/files/:fileUrl/entity` - связанная сущность по файлу
  - `GET /admin/s3/entities/:entityType/:entityId/files` - файлы сущности
- [x] Создать DTO для запросов и ответов
- [x] Добавить валидацию и обработку ошибок
- [x] Добавить guards (AdminJwtGuard, AdminRolesGuard)

---

### ✅ Этап 4: Backend - Регистрация в модуле
**Статус:** ✅ Завершен  
**Файл:** `backend/src/modules/admin/admin.module.ts`

**Задачи:**
- [x] Добавить AdminS3Service в providers
- [x] Добавить AdminS3Controller в controllers
- [x] Убедиться, что все необходимые репозитории импортированы

---

### ✅ Этап 5: Frontend - API методы
**Статус:** ✅ Завершен  
**Файл:** `frontend/src/services/adminApi.ts`

**Задачи:**
- [x] Добавить интерфейсы: `FileInfo`, `S3Stats`, `FileEntityInfo`
- [x] Добавить методы в `s3Api`:
  - `getFiles(params)` - получение списка файлов
  - `getStats()` - получение статистики
  - `getFileEntity(fileUrl)` - получение связанной сущности
  - `getEntityFiles(entityType, entityId)` - получение файлов сущности

---

### ✅ Этап 6: Frontend - AdminS3Page
**Статус:** ✅ Завершен  
**Файл:** `frontend/src/pages/Admin/S3/AdminS3Page.tsx`

**Задачи:**
- [x] Создать компонент страницы
- [x] Реализовать карточки статистики (всего файлов, размер, по папкам)
- [x] Реализовать фильтры (папка, поиск, тип сущности)
- [x] Реализовать таблицу файлов с колонками:
  - Имя файла
  - Размер
  - Папка
  - Тип контента
  - Связанная сущность
  - Дата изменения
  - Действия
- [x] Реализовать пагинацию
- [x] Реализовать сортировку
- [x] Добавить действия: просмотр деталей, переход к сущности, удаление

**Стили:** `frontend/src/pages/Admin/S3/AdminS3Page.module.scss`

---

### ✅ Этап 7: Frontend - EntityDetailsDrawer
**Статус:** ✅ Завершен  
**Файл:** `frontend/src/pages/Admin/S3/EntityDetailsDrawer.tsx`

**Задачи:**
- [x] Создать компонент Drawer для отображения деталей сущности
- [x] Реализовать отображение для Shop (название, владелец, статус)
- [x] Реализовать отображение для CustomPage (название, тип, статус)
- [x] Реализовать отображение для Product (название, цена, магазин)
- [x] Добавить кнопку "Перейти к сущности" для навигации

---

### ✅ Этап 8: Frontend - Роутинг и меню
**Статус:** ✅ Завершен  
**Файлы:** 
- `frontend/src/App.tsx`
- `frontend/src/pages/Admin/Layout/AdminLayout.tsx`

**Задачи:**
- [x] Добавить роут `/admin/s3` в App.tsx
- [x] Добавить пункт меню "S3 Хранилище" в AdminLayout с иконкой CloudOutlined

---

## Структура папок в S3

- `products/` - изображения продуктов
- `shop-logos/` - логотипы магазинов
- `booking-logos/` - логотипы систем бронирования
- `specialist-avatars/` - аватары специалистов
- `service-images/` - изображения услуг
- `message-images/` - изображения сообщений
- `category-images/` - изображения категорий
- `custom-pages/{pageId}/` - файлы статических страниц

## Алгоритм определения связанной сущности

1. **По префиксу папки:**
   - `shop-logos/` → Shop
   - `custom-pages/{pageId}/` → CustomPage (извлечь pageId из пути)
   - `products/` → Product
   - `category-images/` → Category
   - И т.д.

2. **Поиск в БД:**
   - Shop: `WHERE logoUrl = fileUrl`
   - CustomPage: `WHERE id = pageId` (из пути) или `WHERE assets @> [{"s3Key": fileKey}]`
   - Product: `WHERE images @> [fileUrl]` (PostgreSQL JSON)
   - Category: поиск по полю изображения
   - И т.д.

## Примечания

- Использовать пагинацию для больших списков файлов (по умолчанию 50 файлов)
- Кэшировать статистику на 1 минуту
- Ленивая загрузка связанных сущностей
- Обработка ошибок для всех операций
- Индексы в БД для быстрого поиска по URL

## Статус реализации

✅ **Все этапы завершены!**

### Реализовано:

1. ✅ Backend: Расширен S3Service с методами listFiles, getStorageStats, getFileMetadata
2. ✅ Backend: Создан AdminS3Service с логикой определения связанных сущностей
3. ✅ Backend: Создан AdminS3Controller с эндпоинтами для мониторинга S3
4. ✅ Backend: Зарегистрированы все компоненты в AdminModule
5. ✅ Frontend: Добавлены API методы в adminApi.ts
6. ✅ Frontend: Создан AdminS3Page с таблицей, фильтрами и статистикой
7. ✅ Frontend: Создан EntityDetailsDrawer для просмотра деталей сущностей
8. ✅ Frontend: Добавлен роут /admin/s3 и пункт меню в AdminLayout

### Поддерживаемые типы сущностей:

- Shop (магазины)
- CustomPage (кастомные страницы)
- Product (товары)
- Category (категории)
- BookingSystem (системы бронирования)
- Specialist (специалисты)
- Service (услуги)

## Тестирование

- [ ] Проверить получение списка файлов
- [ ] Проверить статистику
- [ ] Проверить определение связанных сущностей для всех типов
- [ ] Проверить навигацию к сущностям
- [ ] Проверить пагинацию и фильтры
- [ ] Проверить производительность на больших объемах данных
