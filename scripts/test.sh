#!/bin/bash

# Скрипт для запуска тестов в Linux/macOS
echo "🧪 Запуск тестов BotManager..."

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова."
    exit 1
fi

# Останавливаем существующие тестовые контейнеры
echo "🛑 Останавливаем существующие тестовые контейнеры..."
docker-compose -f docker-compose.test.yml down

# Собираем и запускаем тестовые контейнеры
echo "🔨 Собираем и запускаем тестовые контейнеры..."
docker-compose -f docker-compose.test.yml up --build -d

# Ждем запуска сервисов
echo "⏳ Ждем запуска сервисов..."
sleep 10

# Запускаем тесты
echo "🧪 Запускаем тесты..."
docker-compose -f docker-compose.test.yml exec backend_test npm run test

# Останавливаем тестовые контейнеры
echo "🛑 Останавливаем тестовые контейнеры..."
docker-compose -f docker-compose.test.yml down

echo ""
echo "✅ Тесты завершены!"
echo ""
