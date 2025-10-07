# BotManager - SaaS платформа для управления Telegram-ботами

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)

## 🚀 Описание проекта

BotManager — это современная SaaS-платформа, позволяющая пользователям создавать, настраивать и управлять Telegram-ботами через интуитивно понятный веб-интерфейс без необходимости программирования. Платформа предоставляет инструменты для построения логики диалогов, дизайна клавиатур, сбора и анализа заявок с последующей монетизацией по подписочной модели.

## ✨ Основные возможности

- 🤖 **Управление ботами** - Создание и настройка Telegram-ботов
- 🎨 **Визуальный конструктор** - Drag & drop интерфейс для создания диалогов
- 📊 **Аналитика** - Детальная статистика и отчеты
- 💼 **CRM система** - Управление заявками и клиентами
- 🔄 **Real-time обновления** - Мгновенные уведомления через WebSocket
- 🔐 **Безопасность** - JWT аутентификация и шифрование данных
- 📱 **Адаптивный дизайн** - Работает на всех устройствах

## 🛠 Технологический стек

### Backend

- **Node.js** - Runtime для JavaScript
- **NestJS** - Прогрессивный Node.js фреймворк
- **TypeScript** - Типизированный JavaScript
- **PostgreSQL** - Основная реляционная база данных
- **Redis** - Кэширование и очереди задач
- **TypeORM** - ORM для работы с базой данных
- **Socket.io** - WebSocket для real-time коммуникации
- **Bull** - Управление очередями задач
- **JWT** - Аутентификация и авторизация

### Frontend

- **React 18** - UI библиотека
- **TypeScript** - Типизированный JavaScript
- **Vite** - Быстрый сборщик
- **Ant Design** - UI компоненты
- **Zustand** - Управление состоянием
- **React Query** - Кэширование данных
- **React Router** - Маршрутизация
- **Socket.io-client** - WebSocket клиент

### Инфраструктура

- **Docker** - Контейнеризация
- **Docker Compose** - Оркестрация контейнеров
- **Nginx** - Обратный прокси и балансировщик нагрузки

## 📁 Структура проекта

```
botmanager/
├── backend/                 # NestJS API сервер
│   ├── src/
│   │   ├── modules/        # Модули приложения
│   │   ├── database/       # Модели и миграции БД
│   │   └── main.ts         # Точка входа
│   ├── scripts/            # Скрипты инициализации БД
│   ├── package.json
│   ├── Dockerfile
│   └── Dockerfile.dev
├── frontend/               # React приложение
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   ├── pages/         # Страницы приложения
│   │   ├── store/         # Zustand store
│   │   ├── services/      # API сервисы
│   │   └── main.tsx       # Точка входа
│   ├── package.json
│   ├── Dockerfile
│   └── Dockerfile.dev
├── scripts/                # Скрипты управления
│   ├── dev.bat            # Запуск разработки (Windows)
│   ├── dev.ps1            # Запуск разработки (PowerShell)
│   ├── dev.sh             # Запуск разработки (Linux/macOS)
│   ├── prod.bat           # Запуск production (Windows)
│   ├── prod.sh            # Запуск production (Linux/macOS)
│   ├── test.bat           # Запуск тестов (Windows)
│   ├── test.sh            # Запуск тестов (Linux/macOS)
│   └── README.md          # Документация скриптов
├── nginx/                  # Nginx конфигурация
│   └── nginx.conf
├── docker-compose.yml      # Docker окружение (разработка)
├── docker-compose.prod.yml # Docker окружение (production)
├── docker-compose.staging.yml # Docker окружение (staging)
├── docker-compose.test.yml # Docker окружение (тестирование)
├── Makefile               # Универсальные команды
├── start.sh               # Скрипт запуска (Linux/macOS)
├── env.example            # Пример переменных окружения
└── README.md
```

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- Docker & Docker Compose
- Git

### Установка и запуск

1. **Клонируйте репозиторий:**

```bash
git clone <repository-url>
cd botmanager
```

2. **Установите зависимости:**

```bash
npm run install
```

**Или по частям:**

```bash
npm run install:backend
npm run install:frontend
```

3. **Настройте окружение:**

```bash
cp env.example .env
# Отредактируйте .env при необходимости
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

5. **Откройте приложение:**

- 🌐 **Frontend**: http://localhost:3001
- 🔧 **Backend API**: http://localhost:3000
- 📚 **API Docs**: http://localhost:3000/api/docs
- 📧 **Mailhog** (dev): http://localhost:8025
- 🗄️ **DBeaver** (DB): http://localhost:8081

### Первые шаги

1. Откройте http://localhost:3001
2. Зарегистрируйтесь или войдите в систему
3. Создайте бота через @BotFather в Telegram
4. Добавьте бота в систему с полученным токеном
5. Настройте диалоги и начните работу!

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

### Локальная разработка

#### Backend

```bash
cd backend
npm install
npm run start:dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Полезные команды

**NPM скрипты:**

```bash
npm run install        # Установить все зависимости
npm run dev           # Запуск разработки
npm run build         # Сборка проекта
npm run test          # Запуск тестов
npm run docker:dev    # Запуск в Docker (разработка)
npm run docker:prod   # Запуск в Docker (production)
npm run docker:logs   # Просмотр логов
npm run clean         # Очистка контейнеров
```

**Docker Compose:**

```bash
# Разработка
docker-compose up --build -d

# Production
docker-compose -f docker-compose.prod.yml up --build -d

# Тестирование
docker-compose -f docker-compose.test.yml up --build -d

# Остановка
docker-compose down

# Логи
docker-compose logs -f
```

**Makefile (универсальный):**

```bash
make help          # Показать справку
make install       # Установить зависимости
make dev           # Запуск разработки
make prod          # Запуск production
make test          # Запуск тестов
make clean         # Очистка контейнеров
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

## 🔧 Конфигурация

### Переменные окружения

Основные настройки в `backend/.env`:

```env
# База данных
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=botmanager
DATABASE_PASSWORD=botmanager_password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_API_URL=https://api.telegram.org/bot
WEBHOOK_BASE_URL=https://yourdomain.com

# Шифрование
ENCRYPTION_KEY=your-32-character-secret-key
```

## 🚀 Развертывание в production

Подробная инструкция по развертыванию доступна в [DEPLOYMENT.md](DEPLOYMENT.md)

### Основные шаги:

1. Настройте SSL сертификаты
2. Обновите переменные окружения
3. Настройте домен и DNS
4. Запустите через Docker Compose
5. Настройте мониторинг и резервное копирование

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

**BotManager** - Создавайте умных Telegram-ботов без программирования! 🚀
