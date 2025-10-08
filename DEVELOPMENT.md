# BotManager Development Setup

## 🚀 Быстрый старт

### 1. Запуск инфраструктуры

**Windows:**

```powershell
.\scripts\dev-db.ps1 start-basic
```

**Linux/Mac:**

```bash
./scripts/dev-db.sh start-basic
```

### 2. Настройка переменных окружения

```bash
cp .envtemplate .env
# Отредактируйте .env файл при необходимости
```

### 3. Запуск Backend API

**Windows:**

```powershell
.\scripts\start-api.ps1
```

**Linux/Mac:**

```bash
./scripts/start-api.sh
```

**Или вручную:**

```bash
cd backend
npm install
npm run start:dev
```

## 📋 Доступные команды

### Управление инфраструктурой

| Команда       | Описание                  |
| ------------- | ------------------------- |
| `start-basic` | PostgreSQL + Redis        |
| `start-all`   | Все сервисы + инструменты |
| `stop`        | Остановить все            |
| `status`      | Статус сервисов           |

### Веб-интерфейсы (при `start-all`)

| Сервис          | URL                   | Логин                  | Пароль   |
| --------------- | --------------------- | ---------------------- | -------- |
| pgAdmin         | http://localhost:5050 | admin@botmanager.local | admin123 |
| Redis Commander | http://localhost:8081 | admin                  | admin123 |
| Grafana         | http://localhost:3001 | admin                  | admin123 |

## 🔧 Конфигурация

- **PostgreSQL**: localhost:5432 (botmanager/botmanager_password)
- **Redis**: localhost:6379
- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/api/docs

## 📝 Примеры

```bash
# Создать бэкап БД
./scripts/dev-db.sh backup

# Подключиться к PostgreSQL
./scripts/dev-db.sh connect-db

# Просмотр логов
./scripts/dev-db.sh logs postgres-dev
```
