# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY backend/package*.json ./


# Копируем исходный код
COPY backend/ ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm ci

# Собираем приложение
RUN npm run build

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Меняем владельца файлов
RUN chown -R nestjs:nodejs /app
USER nestjs

# Открываем порт
EXPOSE 3000

# Команда запуска
# Приложение автоматически проверит наличие критически важных переменных окружения:
# - DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_NAME
# - JWT_SECRET
# Redis опционален (REDIS_URL) - приложение будет работать без очередей
CMD ["npm", "run", "start:prod"]
