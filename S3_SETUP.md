# Настройка S3 для хранения изображений продуктов

## Обзор изменений

Интеграция S3 заменяет хранение изображений в base64 на более эффективное хранение файлов в облачном хранилище.

## Backend изменения

### 1. Новые зависимости

- `@aws-sdk/client-s3` - AWS SDK для S3
- `@aws-sdk/s3-request-presigner` - для presigned URLs
- `multer` и `@types/multer` - для загрузки файлов
- `uuid` и `@types/uuid` - для генерации уникальных имен файлов

### 2. Новые файлы

- `src/config/s3.config.ts` - конфигурация S3
- `src/common/s3.service.ts` - сервис для работы с S3
- `src/modules/upload/` - модуль загрузки файлов
  - `upload.module.ts`
  - `upload.service.ts`
  - `upload.controller.ts`

### 3. Обновленные файлы

- `src/app.module.ts` - добавлен UploadModule
- `src/modules/products/products.service.ts` - интеграция с S3
- `src/modules/products/products.module.ts` - импорт UploadModule
- `src/modules/products/dto/product.dto.ts` - обновлены комментарии

## Frontend изменения

### 1. Новые файлы

- `src/services/uploadService.ts` - сервис загрузки файлов

### 2. Обновленные файлы

- `src/components/ProductsTable/ProductsTable.tsx` - интеграция с новым сервисом

## Настройка окружения

### Переменные окружения (.env)

```env
# AWS S3 (для хранения изображений)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=botmanager-products

# Для MinIO или других S3-совместимых хранилищ (опционально)
AWS_S3_ENDPOINT=http://localhost:9000
AWS_S3_FORCE_PATH_STYLE=true
```

## Настройка S3 хранилища

### Вариант 1: AWS S3

1. Создайте bucket в AWS S3
2. Настройте CORS политику для bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

3. Создайте IAM пользователя с правами:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
   - `s3:PutObjectAcl`

### Вариант 2: MinIO (для разработки)

1. Запустите MinIO локально:

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

2. Создайте bucket через веб-интерфейс (http://localhost:9001)
3. Настройте переменные окружения:

```env
AWS_S3_ENDPOINT=http://localhost:9000
AWS_S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_BUCKET=botmanager-products
```

## API Endpoints

### Загрузка изображений

```
POST /api/upload/product-images
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body: FormData with "images" field (multiple files)
```

### Удаление изображений

```
DELETE /api/upload/product-images
Content-Type: application/json
Authorization: Bearer <token>

Body: {
  "imageUrls": [
    "https://bucket.s3.region.amazonaws.com/products/uuid1.jpg",
    "https://bucket.s3.region.amazonaws.com/products/uuid2.jpg"
  ]
}
```

### Ответы

```json
// Загрузка
{
  "success": true,
  "message": "Successfully uploaded 2 images",
  "imageUrls": [
    "https://bucket.s3.region.amazonaws.com/products/uuid1.jpg",
    "https://bucket.s3.region.amazonaws.com/products/uuid2.jpg"
  ]
}

// Удаление
{
  "success": true,
  "message": "Successfully deleted 2 images"
}
```

## Преимущества новой системы

1. **Производительность**: Изображения не загружают базу данных
2. **Масштабируемость**: S3 может обрабатывать большие объемы файлов
3. **CDN**: Возможность использования CloudFront для быстрой доставки
4. **Резервное копирование**: Автоматическое резервное копирование в S3
5. **Безопасность**: Контролируемый доступ к файлам
6. **Автоматическая очистка**: Неиспользуемые файлы удаляются автоматически

## Миграция существующих данных

Если у вас есть существующие продукты с base64 изображениями, создайте скрипт миграции:

1. Извлеките base64 изображения из базы данных
2. Конвертируйте их в файлы
3. Загрузите в S3
4. Обновите URL в базе данных
5. Удалите старые base64 данные

## Мониторинг и логирование

Сервис автоматически логирует:

- Успешные загрузки файлов
- Ошибки загрузки
- Удаление файлов
- Предупреждения при неудачном удалении

Проверяйте логи для мониторинга работы системы.
