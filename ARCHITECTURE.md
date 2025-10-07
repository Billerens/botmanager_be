# Архитектура BotManager

## Обзор системы

BotManager - это SaaS-платформа для управления Telegram-ботами, построенная на микросервисной архитектуре с использованием современных технологий.

## Технологический стек

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
- **PostgreSQL** - База данных
- **Redis** - Кэш и очереди

## Архитектурные принципы

### 1. Модульность

Система разделена на независимые модули:

- **Auth Module** - Аутентификация и авторизация
- **Users Module** - Управление пользователями
- **Bots Module** - Управление ботами
- **Messages Module** - Обработка сообщений
- **Leads Module** - CRM для заявок
- **Analytics Module** - Аналитика и отчеты
- **WebSocket Module** - Real-time коммуникация
- **Queue Module** - Обработка фоновых задач

### 2. Безопасность

- JWT токены для аутентификации
- Шифрование токенов ботов
- Валидация всех входящих данных
- Rate limiting для API
- CORS настройки
- Security headers

### 3. Масштабируемость

- Горизонтальное масштабирование через Docker
- Очереди задач для асинхронной обработки
- Кэширование часто запрашиваемых данных
- Микросервисная архитектура

### 4. Надежность

- Обработка ошибок на всех уровнях
- Retry механизмы для внешних API
- Логирование всех операций
- Мониторинг состояния системы

## Диаграмма архитектуры

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Nginx         │    │   Backend       │
│   (React)       │◄──►│   (Proxy)       │◄──►│   (NestJS)      │
│   Port: 3001    │    │   Port: 80      │    │   Port: 3000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Redis         │    │   Telegram      │
│   Port: 5432    │◄──►│   Port: 6379    │◄──►│   Bot API       │
│   (Database)    │    │   (Cache/Queue) │    │   (Webhooks)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Поток данных

### 1. Аутентификация пользователя

```
User → Frontend → Backend → JWT → Database
```

### 2. Создание бота

```
User → Frontend → Backend → Telegram API → Database
```

### 3. Обработка сообщений

```
Telegram → Webhook → Backend → Queue → Processing → Database
```

### 4. Real-time обновления

```
Backend → WebSocket → Frontend → UI Update
```

## Модель данных

### Основные сущности

#### User (Пользователь)

- id, email, password
- firstName, lastName
- telegramId, telegramUsername
- role (owner, admin, manager)
- isActive, isEmailVerified

#### Bot (Бот)

- id, name, description
- token (зашифрованный)
- username, status
- totalUsers, totalMessages, totalLeads
- webhookUrl, isWebhookSet

#### Message (Сообщение)

- id, telegramMessageId
- telegramChatId, telegramUserId
- type (incoming, outgoing)
- contentType, text, media
- keyboard, metadata

#### Lead (Заявка)

- id, telegramUserId
- firstName, lastName, username
- phone, email, formData
- status, source, priority
- assignedToId, estimatedValue

#### Subscription (Подписка)

- id, userId, plan
- status, amount, currency
- currentPeriodStart, currentPeriodEnd
- features, limits

## API Endpoints

### Аутентификация

- `POST /auth/login` - Вход в систему
- `POST /auth/register` - Регистрация
- `POST /auth/refresh` - Обновление токена
- `GET /auth/me` - Профиль пользователя

### Боты

- `GET /bots` - Список ботов
- `POST /bots` - Создание бота
- `GET /bots/:id` - Детали бота
- `PATCH /bots/:id` - Обновление бота
- `DELETE /bots/:id` - Удаление бота
- `PATCH /bots/:id/activate` - Активация бота
- `PATCH /bots/:id/deactivate` - Деактивация бота

### Сообщения

- `GET /messages/bot/:botId` - Сообщения бота
- `GET /messages/:id` - Детали сообщения
- `GET /messages/bot/:botId/stats` - Статистика сообщений

### Заявки

- `GET /leads/bot/:botId` - Заявки бота
- `POST /leads` - Создание заявки
- `PATCH /leads/:id` - Обновление заявки
- `DELETE /leads/:id` - Удаление заявки

### WebSocket Events

- `join-room` - Присоединение к комнате
- `leave-room` - Покидание комнаты
- `new-message` - Новое сообщение
- `new-lead` - Новая заявка
- `bot-status-change` - Изменение статуса бота

## Обработка ошибок

### Уровни обработки ошибок

1. **Frontend**

   - Валидация форм
   - Обработка HTTP ошибок
   - Показ пользователю понятных сообщений

2. **Backend**

   - Валидация входящих данных
   - Обработка бизнес-логики
   - Логирование ошибок
   - Возврат структурированных ошибок

3. **Database**
   - Ограничения целостности
   - Индексы для производительности
   - Транзакции для консистентности

## Мониторинг и логирование

### Логирование

- Все API запросы
- Ошибки и исключения
- Бизнес-события
- WebSocket соединения

### Метрики

- Количество активных пользователей
- Количество сообщений в минуту
- Время отклика API
- Использование ресурсов

## Развертывание

### Development

```bash
docker-compose up --build
```

### Production

1. Настройка SSL сертификатов
2. Конфигурация домена
3. Настройка мониторинга
4. Настройка резервного копирования

## Безопасность

### Аутентификация

- JWT токены с истечением срока действия
- Refresh токены для обновления сессий
- Хеширование паролей с bcrypt

### Авторизация

- Роли пользователей (owner, admin, manager)
- Проверка прав доступа на уровне API
- Изоляция данных между пользователями

### Защита данных

- Шифрование токенов ботов
- Валидация всех входящих данных
- Защита от SQL инъекций
- Защита от XSS атак

## Производительность

### Оптимизации

- Кэширование в Redis
- Индексы в базе данных
- Пагинация для больших списков
- Lazy loading компонентов

### Масштабирование

- Горизонтальное масштабирование
- Очереди для асинхронной обработки
- CDN для статических файлов
- Load balancing

## Будущие улучшения

### Планируемые функции

- AI-ассистент для генерации контента
- Расширенная аналитика
- Интеграции с внешними системами
- White-label решения
- Мобильное приложение

### Технические улучшения

- Микросервисная архитектура
- Kubernetes для оркестрации
- GraphQL API
- Event sourcing
- CQRS паттерн
