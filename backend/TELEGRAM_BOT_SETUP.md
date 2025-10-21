# Telegram Bot Assistant - Инструкция по настройке

## Описание функциональности

Наш Telegram бот-ассистент обрабатывает команду `/start` и предоставляет пользователям персонализированную информацию:

- **Для новых пользователей**: Приветствие + инструкции по регистрации + Telegram ID
- **Для зарегистрированных пользователей**: Приветствие + ссылка на веб-интерфейс

## Настройка бота

### 1. Создание бота в Telegram

1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный токен

### 2. Настройка переменных окружения

Добавьте в файл `.env`:

```env
# Telegram Bot Token (обязательно)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# Webhook URL (для production)
WEBHOOK_BASE_URL=https://your-domain.com

# Frontend URL (для ссылок в сообщениях)
FRONTEND_URL=https://your-frontend-domain.com
```

### 3. Настройка webhook (автоматически)

При запуске приложения webhook устанавливается автоматически:

```bash
npm run start:dev
```

Логи покажут:

```
🤖 Telegram webhook инициализирован
```

### 4. Ручная установка webhook (опционально)

Если нужно установить webhook вручную:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/telegram/webhook"}'
```

## Как это работает

### Команда /start

Когда пользователь отправляет `/start`:

1. **Проверка в базе данных**: Система ищет пользователя по `telegramId`
2. **Для новых пользователей**:

   ```
   Привет, [Имя]! 👋

   Добро пожаловать в BotManager! 🚀

   Для начала работы с нашим сервисом вам необходимо зарегистрироваться.

   📋 Ваш Telegram ID: `123456789`

   🔗 Перейдите по ссылке для регистрации:
   https://your-frontend.com/register

   📝 Инструкция по регистрации:
   1. Откройте ссылку выше
   2. Введите ваш Telegram ID: `123456789`
   3. Заполните остальные поля
   4. Подтвердите регистрацию кодом, который мы отправим

   После регистрации вы сможете создавать и управлять Telegram ботами! 🤖
   ```

3. **Для зарегистрированных пользователей**:

   ```
   Привет, [Имя]! 👋

   Добро пожаловать обратно в BotManager! Ваш аккаунт уже зарегистрирован и готов к использованию.

   Для управления ботами перейдите в веб-интерфейс: https://your-frontend.com
   ```

## API Endpoints

### POST /api/telegram/webhook

Обрабатывает входящие сообщения от Telegram

### POST /api/telegram/set-webhook

Устанавливает webhook для бота

## Безопасность

В production рекомендуется:

1. **Проверка подписи Telegram**:

   ```typescript
   // В telegram-webhook.controller.ts
   const signature = headers["x-telegram-bot-api-secret-token"];
   if (!this.verifyTelegramSignature(update, signature)) {
     throw new UnauthorizedException("Invalid Telegram signature");
   }
   ```

2. **HTTPS обязательно** для webhook URL

3. **Rate limiting** для предотвращения спама

## Логирование

Все действия логируются:

```
[TelegramWebhookService] Получен webhook: {...}
[TelegramWebhookService] Обработка сообщения от 123456789: /start
[TelegramWebhookService] Сообщение успешно отправлено в Telegram для chatId: 123456789
```

## Тестирование

1. **Локальное тестирование**: Используйте ngrok для туннелирования
2. **Production**: Убедитесь, что webhook URL доступен извне
3. **Проверка логов**: Следите за логами при отправке `/start`

## Troubleshooting

### Webhook не устанавливается

- Проверьте `TELEGRAM_BOT_TOKEN`
- Убедитесь, что `WEBHOOK_BASE_URL` доступен извне
- Проверьте логи на ошибки

### Сообщения не отправляются

- Проверьте токен бота
- Убедитесь, что пользователь начал диалог с ботом
- Проверьте права бота на отправку сообщений

### Пользователь не найден в БД

- Проверьте подключение к базе данных
- Убедитесь, что миграции выполнены
- Проверьте правильность `telegramId` в БД
