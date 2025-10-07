#!/bin/sh

# Скрипт запуска BotManager API с автоматическим применением миграций
# Этот скрипт выполняется в Docker контейнере

set -e  # Выходим при любой ошибке

echo "🚀 Запуск BotManager API..."
echo "📅 $(date)"

# Функция для проверки подключения к базе данных
check_database_connection() {
    echo "🔄 Проверяем подключение к базе данных..."
    
    # Пытаемся подключиться к базе данных с таймаутом
    timeout=30
    counter=0
    
    while [ $counter -lt $timeout ]; do
        if npm run typeorm -- query "SELECT 1" --dataSource dist/database/data-source.js > /dev/null 2>&1; then
            echo "✅ База данных подключена"
            return 0
        fi
        
        echo "⏳ База данных недоступна - ждем... ($counter/$timeout)"
        sleep 2
        counter=$((counter + 2))
    done
    
    echo "❌ Не удалось подключиться к базе данных за $timeout секунд"
    return 1
}

# Функция для применения миграций
run_migrations() {
    echo "🔄 Проверяем статус миграций..."
    
    # Показываем текущий статус миграций
    npm run typeorm -- migration:show --dataSource dist/database/data-source.js || true
    
    echo "🔄 Применяем миграции..."
    
    # Применяем миграции
    if npm run typeorm -- migration:run --dataSource dist/database/data-source.js; then
        echo "✅ Миграции успешно применены"
        
        # Показываем финальный статус
        echo "📊 Финальный статус миграций:"
        npm run typeorm -- migration:show --dataSource dist/database/data-source.js || true
    else
        echo "❌ Ошибка при применении миграций"
        return 1
    fi
}

# Функция для запуска приложения
start_application() {
    echo "🚀 Запускаем BotManager API..."
    exec npm run start:prod
}

# Основная логика
main() {
    # Проверяем подключение к базе данных
    if ! check_database_connection; then
        echo "❌ Критическая ошибка: не удалось подключиться к базе данных"
        exit 1
    fi
    
    # Применяем миграции
    if ! run_migrations; then
        echo "❌ Критическая ошибка: не удалось применить миграции"
        exit 1
    fi
    
    # Запускаем приложение
    start_application
}

# Запускаем основную функцию
main "$@"
