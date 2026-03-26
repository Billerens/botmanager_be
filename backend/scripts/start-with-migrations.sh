#!/bin/sh

# Скрипт запуска UForge API с автоматическим применением миграций
# Этот скрипт выполняется в Docker контейнере

set -e  # Выходим при любой ошибке

echo "🚀 Запуск UForge API..."
echo "📅 $(date)"

# Быстрый запуск TypeORM CLI (без ts-node) для production/dist
TYPEORM_CLI="node ./node_modules/typeorm/cli.js"
DATA_SOURCE_PATH="dist/database/data-source.js"

# Функция для проверки подключения к базе данных
check_database_connection() {
    echo "🔄 Проверяем подключение к базе данных..."
    
    # Пытаемся подключиться к базе данных с таймаутом
    timeout=30
    interval=1
    counter=0
    last_error=""
    
    while [ $counter -lt $timeout ]; do
        set +e
        connection_output=$(node -e '
const { Client } = require("pg");
const client = new Client({
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  user: process.env.DATABASE_USERNAME || "botmanager",
  password: process.env.DATABASE_PASSWORD || "botmanager_password",
  database: process.env.DATABASE_NAME || "botmanager_dev",
  connectionTimeoutMillis: 1500,
  statement_timeout: 1500,
  query_timeout: 1500,
});
(async () => {
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    process.exit(0);
  } catch (err) {
    try { await client.end(); } catch (_) {}
    console.error(err?.message || err);
    process.exit(1);
  }
})();
' 2>&1)
        connection_exit_code=$?
        set -e
        
        if [ $connection_exit_code -eq 0 ]; then
            echo "✅ База данных подключена"
            return 0
        fi
        
        last_error="$connection_output"
        echo "⏳ База данных недоступна - ждем... ($counter/$timeout)"
        sleep $interval
        counter=$((counter + interval))
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
    echo "🔄 Применяем миграции..."
    
    # Применяем миграции с захватом вывода
    set +e
    migration_output=$($TYPEORM_CLI migration:run -d "$DATA_SOURCE_PATH" 2>&1)
    migration_exit_code=$?
    set -e
    
    if [ $migration_exit_code -eq 0 ]; then
        echo "✅ Миграции успешно применены"
        echo "$migration_output"
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
    echo "🚀 Запускаем UForge API..."
    exec yarn start:prod
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
