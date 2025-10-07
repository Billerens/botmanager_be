#!/bin/bash

echo "🚀 Запуск BotManager..."

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Пожалуйста, установите Docker и попробуйте снова."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Пожалуйста, установите Docker Compose и попробуйте снова."
    exit 1
fi

# Создаем .env файл если его нет
if [ ! -f backend/.env ]; then
    echo "📝 Создаем файл конфигурации..."
    cp backend/config.example.env backend/.env
    echo "✅ Файл .env создан. Пожалуйста, отредактируйте его перед запуском."
fi

# Собираем и запускаем контейнеры
echo "🔨 Сборка и запуск контейнеров..."
docker-compose up --build -d

# Ждем запуска сервисов
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# Проверяем статус контейнеров
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "✅ BotManager запущен!"
echo ""
echo "🌐 Frontend: http://localhost:3001"
echo "🔧 Backend API: http://localhost:3000"
echo "📚 API Docs: http://localhost:3000/api/docs"
echo "🗄️  PostgreSQL: localhost:5432"
echo "📦 Redis: localhost:6379"
echo ""
echo "Для остановки выполните: docker-compose down"
echo "Для просмотра логов: docker-compose logs -f"
