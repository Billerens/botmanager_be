# BotManager Backend - Инструкции по развертыванию

## 🚀 Быстрый старт с Docker

### 1. Подготовка окружения

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
# База данных
DATABASE_NAME=botmanager_prod
DATABASE_USERNAME=botmanager
DATABASE_PASSWORD=your-secure-database-password

# Redis
REDIS_PASSWORD=your-redis-password

# JWT секреты (ОБЯЗАТЕЛЬНО измените в продакшене!)
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=https://botmanagertest.online,https://www.botmanagertest.online

# API
API_PREFIX=api
NODE_ENV=production
PORT=3000

# Webhook URL
WEBHOOK_BASE_URL=https://api.botmanagertest.online

# Telegram
TELEGRAM_BOT_API_URL=https://api.telegram.org/bot

# Шифрование
ENCRYPTION_KEY=your-32-character-secret-key-12345

# Логирование
LOG_LEVEL=info
```

### 2. Запуск с Docker Compose

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f api

# Остановка
docker-compose down
```

### 3. Проверка работы

- **API**: http://localhost:3000/api/docs
- **База данных**: localhost:5432
- **Redis**: localhost:6379

## 🔧 Ручное развертывание

### 1. Установка зависимостей

```bash
cd backend
npm ci
```

### 2. Настройка базы данных

```bash
# Проверка подключения
npm run db:check

# Просмотр статуса миграций
npm run migration:show

# Применение миграций
npm run migration:run
```

### 3. Запуск приложения

```bash
# Разработка
npm run start:dev

# Продакшен
npm run start:prod

# С автоматическими миграциями
npm run start:with-migrations
```

## 📊 Управление миграциями

### Просмотр статуса

```bash
npm run migration:show
```

### Применение миграций

```bash
npm run migration:run
```

### Откат миграций

```bash
npm run migration:revert
```

### Создание новой миграции

```bash
npm run migration:generate -- -n YourMigrationName
```

## 🐳 Docker команды

### Сборка образа

```bash
docker build -t botmanager-api .
```

### Запуск контейнера

```bash
docker run -d \
  --name botmanager-api \
  --env-file .env \
  -p 3000:3000 \
  botmanager-api
```

### Просмотр логов

```bash
docker logs -f botmanager-api
```

## 🔍 Диагностика проблем

### Проверка подключения к БД

```bash
npm run db:check
```

### Проверка статуса миграций

```bash
npm run migration:show
```

### Просмотр логов приложения

```bash
# Docker
docker logs botmanager-api

# Docker Compose
docker-compose logs api
```

## 🚨 Решение проблем

### Ошибка "relation does not exist"

Эта ошибка означает, что миграции не были применены. Решение:

1. **С Docker Compose**: Перезапустите сервис

   ```bash
   docker-compose restart api
   ```

2. **Ручное развертывание**: Примените миграции
   ```bash
   npm run migration:run
   ```

### Ошибка подключения к БД

1. Проверьте переменные окружения
2. Убедитесь, что база данных запущена
3. Проверьте сетевые настройки

### CORS ошибки

Убедитесь, что в переменной `CORS_ORIGIN` указан правильный домен фронтенда.

## 📝 Переменные окружения

| Переменная          | Описание           | Обязательная | По умолчанию          |
| ------------------- | ------------------ | ------------ | --------------------- |
| `DATABASE_HOST`     | Хост БД            | ✅           | localhost             |
| `DATABASE_PORT`     | Порт БД            | ✅           | 5432                  |
| `DATABASE_USERNAME` | Пользователь БД    | ✅           | botmanager            |
| `DATABASE_PASSWORD` | Пароль БД          | ✅           | -                     |
| `DATABASE_NAME`     | Имя БД             | ✅           | botmanager_dev        |
| `JWT_SECRET`        | JWT секрет         | ✅           | -                     |
| `REDIS_HOST`        | Хост Redis         | ✅           | localhost             |
| `REDIS_PORT`        | Порт Redis         | ✅           | 6379                  |
| `REDIS_PASSWORD`    | Пароль Redis       | ❌           | -                     |
| `CORS_ORIGIN`       | Разрешенные домены | ❌           | http://localhost:3001 |
| `WEBHOOK_BASE_URL`  | URL для webhook    | ❌           | http://localhost:3000 |
