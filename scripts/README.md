# Скрипты BotManager

Этот каталог содержит скрипты для управления проектом BotManager на разных платформах.

## 🖥️ Поддерживаемые платформы

- **Windows** - .bat и .ps1 скрипты
- **Linux/macOS** - .sh скрипты
- **Универсальный** - Makefile

## 📁 Структура файлов

```
scripts/
├── README.md           # Этот файл
├── install.bat         # Установка зависимостей (Windows)
├── install.ps1         # Установка зависимостей (PowerShell)
├── install.sh          # Установка зависимостей (Linux/macOS)
├── dev.bat             # Запуск разработки (Windows)
├── dev.ps1             # Запуск разработки (PowerShell)
├── dev.sh              # Запуск разработки (Linux/macOS)
├── prod.bat            # Запуск production (Windows)
├── prod.sh             # Запуск production (Linux/macOS)
├── test.bat            # Запуск тестов (Windows)
└── test.sh             # Запуск тестов (Linux/macOS)
```

## 🚀 Быстрый старт

### Windows

```cmd
# Установка зависимостей
scripts\install.bat

# Запуск разработки
scripts\dev.bat

# Запуск production
scripts\prod.bat

# Запуск тестов
scripts\test.bat
```

### PowerShell (Windows)

```powershell
# Установка зависимостей
.\scripts\install.ps1

# Запуск разработки
.\scripts\dev.ps1
```

### Linux/macOS

```bash
# Сделать скрипты исполняемыми
chmod +x scripts/*.sh

# Установка зависимостей
./scripts/install.sh

# Запуск разработки
./scripts/dev.sh

# Запуск production
./scripts/prod.sh

# Запуск тестов
./scripts/test.sh
```

### Универсальный (Makefile)

```bash
# Показать справку
make help

# Установка зависимостей
make install

# Запуск разработки
make dev

# Запуск production
make prod

# Запуск тестов
make test

# Очистка
make clean
```

## 🔧 Docker Compose файлы

Проект использует разные docker-compose файлы для разных окружений:

- `docker-compose.yml` - **Разработка** (по умолчанию)
- `docker-compose.prod.yml` - **Production**
- `docker-compose.staging.yml` - **Staging**
- `docker-compose.test.yml` - **Тестирование**

## 📋 Доступные команды

### Установка и настройка

- `install` - Установить все зависимости
- `clean` - Очистить контейнеры и volumes

### Разработка

- `dev` - Запустить в режиме разработки
- `dev-backend` - Запустить только backend
- `dev-frontend` - Запустить только frontend

### Production

- `prod` - Запустить в production режиме
- `prod-build` - Собрать production образы
- `prod-deploy` - Деплой в production

### Тестирование

- `test` - Запустить все тесты
- `test-unit` - Запустить unit тесты
- `test-e2e` - Запустить e2e тесты

### Мониторинг

- `logs` - Показать логи
- `status` - Показать статус контейнеров
- `health` - Проверить здоровье сервисов
- `stop` - Остановить все контейнеры

### База данных

- `db-migrate` - Запустить миграции
- `db-reset` - Сбросить базу данных

## 🌐 Порты

После запуска сервисы будут доступны по следующим адресам:

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Mailhog** (dev): http://localhost:8025

## 🔍 Отладка

### Просмотр логов

```bash
# Все сервисы
make logs

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Подключение к контейнеру

```bash
# Backend
docker-compose exec backend sh

# Frontend
docker-compose exec frontend sh

# PostgreSQL
docker-compose exec postgres psql -U botmanager -d botmanager_dev
```

### Перезапуск сервиса

```bash
# Перезапустить backend
docker-compose restart backend

# Перезапустить frontend
docker-compose restart frontend
```

## 🛠️ Разработка

### Hot Reload

В режиме разработки включен hot reload:

- Backend автоматически перезапускается при изменении файлов
- Frontend автоматически обновляется в браузере

### Отладка Backend

Backend запускается с отладочным портом 9229:

- VS Code: Attach to Node Process
- Chrome: chrome://inspect

### Переменные окружения

Скопируйте `env.example` в `.env` и настройте переменные:

```bash
cp env.example .env
```

## 🚨 Устранение неполадок

### Проблемы с портами

Если порты заняты, измените их в docker-compose файлах.

### Проблемы с правами (Linux/macOS)

```bash
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

### Очистка Docker

```bash
make clean
docker system prune -a
```

### Переустановка зависимостей

```bash
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
make install
```
