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
    last_error=""
    
    while [ $counter -lt $timeout ]; do
        connection_output=$(npm run typeorm -- query "SELECT 1" --dataSource dist/database/data-source.js 2>&1)
        connection_exit_code=$?
        
        if [ $connection_exit_code -eq 0 ]; then
            echo "✅ База данных подключена"
            return 0
        fi
        
        last_error="$connection_output"
        echo "⏳ База данных недоступна - ждем... ($counter/$timeout)"
        sleep 2
        counter=$((counter + 2))
    done
    
    echo "❌ Не удалось подключиться к базе данных за $timeout секунд"
    echo ""
    echo "📋 Последняя ошибка подключения:"
    echo "----------------------------------------"
    echo "$last_error"
    echo "----------------------------------------"
    echo ""
    echo "🔧 Конфигурация подключения к БД:"
    echo "  - Host: ${DATABASE_HOST:-не установлен}"
    echo "  - Port: ${DATABASE_PORT:-не установлен}"
    echo "  - Database: ${DATABASE_NAME:-не установлен}"
    echo "  - User: ${DATABASE_USERNAME:-не установлен}"
    echo ""
    echo "💡 Возможные причины:"
    echo "  1. База данных еще не запущена"
    echo "  2. Неверные параметры подключения"
    echo "  3. Сетевые проблемы или firewall"
    echo "  4. База данных не принимает соединения"
    echo "  5. Неверные учетные данные"
    echo ""
    return 1
}

# Функция для применения миграций
run_migrations() {
    echo "🔄 Проверяем статус миграций..."
    
    # Показываем текущий статус миграций
    migration_show_output=$(npm run typeorm -- migration:show --dataSource dist/database/data-source.js 2>&1) || true
    echo "$migration_show_output"
    
    echo "🔄 Применяем миграции..."
    
    # Применяем миграции с захватом вывода
    migration_output=$(npm run typeorm -- migration:run --dataSource dist/database/data-source.js 2>&1)
    migration_exit_code=$?
    
    if [ $migration_exit_code -eq 0 ]; then
        echo "✅ Миграции успешно применены"
        echo "$migration_output"
        
        # Показываем финальный статус
        echo "📊 Финальный статус миграций:"
        npm run typeorm -- migration:show --dataSource dist/database/data-source.js || true
    else
        echo "❌ Ошибка при применении миграций"
        echo "🔍 Код ошибки: $migration_exit_code"
        echo ""
        echo "📋 Детали ошибки:"
        echo "----------------------------------------"
        echo "$migration_output"
        echo "----------------------------------------"
        echo ""
        echo "🔧 Конфигурация подключения к БД:"
        echo "  - Host: ${DATABASE_HOST:-не установлен}"
        echo "  - Port: ${DATABASE_PORT:-не установлен}"
        echo "  - Database: ${DATABASE_NAME:-не установлен}"
        echo "  - User: ${DATABASE_USERNAME:-не установлен}"
        echo ""
        echo "💡 Возможные причины:"
        echo "  1. Ошибка в коде миграции"
        echo "  2. Нарушение целостности данных или ограничений БД"
        echo "  3. Недостаточно прав у пользователя БД"
        echo "  4. Конфликт с существующими данными"
        echo "  5. Несовместимость схемы БД"
        echo ""
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
