# Инструкция по развертыванию BotManager

## Быстрый старт

### 1. Клонирование и подготовка

```bash
git clone <repository-url>
cd botmanager
```

### 2. Настройка окружения

Скопируйте файл конфигурации и отредактируйте его:

```bash
cp backend/config.example.env backend/.env
```

Отредактируйте `backend/.env` и укажите:

- `JWT_SECRET` - секретный ключ для JWT токенов
- `ENCRYPTION_KEY` - ключ для шифрования токенов ботов
- `WEBHOOK_BASE_URL` - URL вашего сервера для webhook'ов

### 3. Запуск через Docker

```bash
# Запуск всех сервисов
docker-compose up --build -d

# Или используйте скрипт
./start.sh
```

### 4. Проверка работы

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- API документация: http://localhost:3000/api/docs

## Ручная установка (для разработки)

### Backend

```bash
cd backend
npm install
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### База данных

Убедитесь, что PostgreSQL и Redis запущены:

```bash
# PostgreSQL
createdb botmanager

# Redis
redis-server
```

## Настройка Telegram ботов

### 1. Создание бота

1. Найдите @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен

### 2. Добавление бота в систему

1. Войдите в веб-интерфейс BotManager
2. Перейдите в раздел "Боты"
3. Нажмите "Добавить бота"
4. Введите название и токен бота
5. Бот будет автоматически активирован

## Настройка webhook'ов

Для работы с ботами необходимо настроить webhook'ы:

1. Убедитесь, что `WEBHOOK_BASE_URL` в `.env` указывает на ваш домен
2. Webhook'и будут автоматически настроены при создании бота
3. URL webhook'а: `https://yourdomain.com/telegram/webhook/{botId}`

## Мониторинг и логи

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Мониторинг ресурсов

```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats
```

## Безопасность

### 1. Смена паролей по умолчанию

Обязательно смените пароли в `docker-compose.yml`:

```yaml
environment:
  POSTGRES_PASSWORD: your-secure-password
  REDIS_PASSWORD: your-redis-password
```

### 2. Настройка SSL

Для production используйте SSL сертификаты:

1. Получите SSL сертификат (Let's Encrypt)
2. Настройте nginx для HTTPS
3. Обновите `WEBHOOK_BASE_URL` на HTTPS

### 3. Firewall

Настройте firewall для ограничения доступа:

```bash
# Разрешить только необходимые порты
ufw allow 80
ufw allow 443
ufw allow 22
ufw enable
```

## Масштабирование

### Горизонтальное масштабирование

Для увеличения производительности:

1. Увеличьте количество worker'ов в `docker-compose.yml`
2. Настройте load balancer
3. Используйте внешние сервисы для PostgreSQL и Redis

### Вертикальное масштабирование

Увеличьте ресурсы сервера:

- CPU: минимум 2 ядра
- RAM: минимум 4GB
- Диск: минимум 20GB SSD

## Резервное копирование

### База данных

```bash
# Создание бэкапа
docker-compose exec postgres pg_dump -U botmanager botmanager > backup.sql

# Восстановление
docker-compose exec -T postgres psql -U botmanager botmanager < backup.sql
```

### Автоматическое резервное копирование

Создайте cron задачу:

```bash
# Добавьте в crontab
0 2 * * * /path/to/backup-script.sh
```

## Обновление

```bash
# Остановка сервисов
docker-compose down

# Обновление кода
git pull

# Пересборка и запуск
docker-compose up --build -d
```

## Устранение неполадок

### Проблемы с подключением к БД

```bash
# Проверка статуса PostgreSQL
docker-compose exec postgres pg_isready

# Подключение к БД
docker-compose exec postgres psql -U botmanager botmanager
```

### Проблемы с Redis

```bash
# Проверка статуса Redis
docker-compose exec redis redis-cli ping
```

### Проблемы с webhook'ами

1. Проверьте, что `WEBHOOK_BASE_URL` доступен извне
2. Убедитесь, что порт 80/443 открыт
3. Проверьте логи nginx и backend

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs -f`
2. Убедитесь, что все сервисы запущены: `docker-compose ps`
3. Проверьте конфигурацию в `.env`
4. Создайте issue в репозитории проекта
