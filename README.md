# BotManager Backend - SaaS платформа для управления Telegram-ботами

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)

## 🚀 Описание проекта

BotManager Backend — это мощный API сервер для SaaS-платформы, позволяющей пользователям создавать, настраивать и управлять Telegram-ботами через REST API и WebSocket соединения. Платформа предоставляет инструменты для построения логики диалогов, сбора и анализа заявок с последующей монетизацией по подписочной модели.

## ✨ Основные возможности

- 🤖 **Управление ботами** - Создание и настройка Telegram-ботов через API
- 📊 **Аналитика** - Детальная статистика и отчеты
- 💼 **CRM система** - Управление заявками и клиентами
- 🔄 **Real-time обновления** - Мгновенные уведомления через WebSocket
- 🔐 **Безопасность** - JWT аутентификация и шифрование данных
- 📱 **REST API** - Полноценный API для интеграции с любыми клиентами

## 🛠 Технологический стек

- **Node.js** - Runtime для JavaScript
- **NestJS** - Прогрессивный Node.js фреймворк
- **TypeScript** - Типизированный JavaScript
- **PostgreSQL** - Основная реляционная база данных
- **Redis** - Кэширование и очереди задач
- **TypeORM** - ORM для работы с базой данных
- **Socket.io** - WebSocket для real-time коммуникации
- **Bull** - Управление очередями задач
- **JWT** - Аутентификация и авторизация

## 📁 Структура проекта

```
botmanager-backend/
├── backend/                 # NestJS API сервер
│   ├── src/
│   │   ├── modules/        # Модули приложения
│   │   ├── database/       # Модели и миграции БД
│   │   └── main.ts         # Точка входа
│   ├── scripts/            # Скрипты инициализации БД
│   ├── package.json
│   └── tsconfig.json
├── scripts/                # Скрипты управления
│   ├── dev.bat            # Запуск разработки (Windows)
│   ├── dev.ps1            # Запуск разработки (PowerShell)
│   ├── dev.sh             # Запуск разработки (Linux/macOS)
│   ├── prod.bat           # Запуск production (Windows)
│   ├── prod.sh            # Запуск production (Linux/macOS)
│   ├── test.bat           # Запуск тестов (Windows)
│   ├── test.sh            # Запуск тестов (Linux/macOS)
│   └── README.md          # Документация скриптов
├── Dockerfile             # Docker образ для развертывания
├── .dockerignore          # Исключения для Docker
├── Makefile               # Универсальные команды
├── start.sh               # Скрипт запуска (Linux/macOS)
├── env.example            # Пример переменных окружения
└── README.md
```

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- PostgreSQL
- Redis
- Git

### Локальная разработка

1. **Клонируйте репозиторий:**

```bash
git clone <repository-url>
cd botmanager-backend
```

2. **Установите зависимости:**

```bash
npm run install
```

3. **Настройте окружение:**

```bash
cp backend/env.example backend/.env
# Отредактируйте backend/.env при необходимости
```

4. **Запустите приложение:**

**Windows:**

```cmd
scripts\dev.bat
```

**Linux/macOS:**

```bash
./scripts/dev.sh
```

**Универсальный:**

```bash
make dev
```

5. **Доступные сервисы:**

- 🔧 **Backend API**: http://localhost:3000
- 📚 **API Docs**: http://localhost:3000/api/docs

### Облачное развертывание

Проект готов для развертывания в любом облачном сервисе (Heroku, Railway, Render, DigitalOcean App Platform и т.д.):

1. **Создайте Docker образ:**

```bash
docker build -t botmanager-backend .
```

2. **Запустите контейнер:**

```bash
docker run -p 3000:3000 \
  -e DATABASE_HOST=your-db-host \
  -e DATABASE_PORT=5432 \
  -e DATABASE_USERNAME=your-username \
  -e DATABASE_PASSWORD=your-password \
  -e DATABASE_NAME=your-db-name \
  -e REDIS_URL=your-redis-url \
  -e JWT_SECRET=your-jwt-secret \
  botmanager-backend
```

3. **Или используйте docker-compose (если нужна локальная инфраструктура):**

```bash
# Создайте docker-compose.yml с вашими настройками
docker-compose up -d
```

## 💰 Тарифные планы

### 🚀 Старт ($15/мес)

- 1 бот
- До 500 пользователей
- Базовые типы ответов (текст, фото, кнопки)
- Экспорт заявок в CSV
- Базовая аналитика
- Доступ для 1 пользователя

### 💼 Бизнес ($35/мес)

- 3 бота
- До 5000 пользователей
- Расширенные типы ответов
- Цепочки сообщений
- Групповые чаты
- Real-time обновления
- Приоритетная поддержка
- Доступ для 3 сотрудников

### 🏆 Про ($75/мес)

- Неограниченное количество ботов
- До 20000 пользователей
- AI-ассистент
- Интеграции через Webhook
- Глубокая аналитика
- White-label решения
- Доступ для 10 сотрудников

## 🛠 Разработка

### Полезные команды

**NPM скрипты:**

```bash
npm run install        # Установить зависимости
npm run dev           # Запуск разработки
npm run build         # Сборка проекта
npm run start         # Запуск в production режиме
npm run test          # Запуск тестов
npm run test:e2e      # Запуск e2e тестов
npm run test:cov      # Запуск тестов с покрытием
npm run lint          # Проверка кода линтером
npm run format        # Форматирование кода
npm run migration:generate # Создать миграцию
npm run migration:run     # Применить миграции
npm run migration:revert  # Откатить миграцию
```

**Makefile (универсальный):**

```bash
make help          # Показать справку
make install       # Установить зависимости
make dev           # Запуск разработки
make build         # Сборка backend
make start         # Запуск в production
make test          # Запуск тестов
make lint          # Проверка кода
make format        # Форматирование кода
make migration:generate # Создать миграцию
make migration:run     # Применить миграции
make migration:revert  # Откатить миграцию
```

## 📊 API Документация

После запуска приложения API документация доступна по адресу:
http://localhost:3000/api/docs

### Основные endpoints:

- `POST /auth/login` - Вход в систему
- `POST /auth/register` - Регистрация
- `GET /bots` - Список ботов
- `POST /bots` - Создание бота
- `GET /leads` - Список заявок
- `GET /analytics/dashboard` - Статистика дашборда
- `WebSocket /socket.io/` - Real-time обновления

## 🔧 Конфигурация

### Переменные окружения

Приложение автоматически проверяет наличие критически важных переменных окружения при запуске. Если какие-то переменные отсутствуют, приложение выведет подробную информацию о том, что нужно настроить.

Основные настройки в `backend/.env`:

```env
# База данных (ОБЯЗАТЕЛЬНО)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=botmanager
DATABASE_PASSWORD=botmanager_password
DATABASE_NAME=botmanager_dev

# JWT (ОБЯЗАТЕЛЬНО)
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_API_URL=https://api.telegram.org/bot
WEBHOOK_BASE_URL=https://yourdomain.com

# Redis (ОБЯЗАТЕЛЬНО)
REDIS_URL=redis://localhost:6379

# Шифрование
ENCRYPTION_KEY=your-32-character-secret-key
```

### Проверка переменных окружения

При запуске приложение автоматически проверяет наличие следующих критически важных переменных:

- `DATABASE_HOST` - Хост базы данных PostgreSQL
- `DATABASE_PORT` - Порт базы данных PostgreSQL
- `DATABASE_USERNAME` - Имя пользователя базы данных
- `DATABASE_PASSWORD` - Пароль базы данных
- `DATABASE_NAME` - Название базы данных
- `JWT_SECRET` - Секретный ключ для JWT токенов
- `REDIS_URL` - URL подключения к Redis

Если какая-либо из этих переменных отсутствует, приложение выведет подробную информацию и завершит работу с кодом ошибки 1.

## 🚀 Развертывание в production

### Облачные платформы

Проект готов для развертывания на:

- **Heroku** - Просто подключите GitHub репозиторий
- **Railway** - Автоматическое развертывание из Git
- **Render** - Простое развертывание с Docker
- **DigitalOcean App Platform** - Масштабируемое развертывание
- **AWS ECS/Fargate** - Enterprise решение
- **Google Cloud Run** - Serverless контейнеры

### Основные шаги:

1. Настройте переменные окружения в облачном сервисе
2. Подключите внешнюю PostgreSQL базу данных
3. Подключите внешний Redis сервис
4. Запустите развертывание через Docker
5. Настройте домен и SSL сертификаты

## 🏗 Архитектура

Подробное описание архитектуры системы доступно в [ARCHITECTURE.md](ARCHITECTURE.md)

### Ключевые принципы:

- **Модульность** - Независимые модули для каждой функции
- **Безопасность** - JWT токены, шифрование, валидация
- **Масштабируемость** - Горизонтальное масштабирование
- **Надежность** - Обработка ошибок, логирование

## 🤝 Вклад в проект

Мы приветствуем вклад в развитие проекта! Пожалуйста:

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📝 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 📞 Поддержка

- 📧 Email: support@botmanager.com
- 💬 Telegram: @botmanager_support
- 🐛 Issues: [GitHub Issues](https://github.com/botmanager/issues)

## 🙏 Благодарности

Спасибо всем контрибьюторам и сообществу за поддержку проекта!

---

**BotManager Backend** - Мощный API для управления Telegram-ботами! 🚀
