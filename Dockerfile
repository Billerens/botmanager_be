# Используем официальный Node.js образ
FROM node:22-alpine

# Включение Corepack для Yarn
RUN corepack enable

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и yarn.lock
COPY backend/package.json backend/yarn.lock* ./


# Копируем исходный код
COPY backend/ ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN yarn install --frozen-lockfile

# Собираем приложение
RUN yarn build

# Копируем скрипт запуска с миграциями
COPY backend/scripts/start-with-migrations.sh /app/start.sh

# Делаем скрипт исполняемым
RUN chmod +x /app/start.sh

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Меняем владельца файлов
RUN chown -R nestjs:nodejs /app
USER nestjs

# Открываем порт
EXPOSE 3000

# Команда запуска с автоматическим применением миграций
# Приложение автоматически проверит наличие критически важных переменных окружения:
# - DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_NAME
# - JWT_SECRET
# - REDIS_URL
CMD ["/app/start.sh"]
