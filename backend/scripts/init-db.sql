-- Инициализация базы данных для разработки
-- Этот скрипт выполняется при первом запуске PostgreSQL контейнера

-- Создаем расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Создаем индексы для производительности
-- (Таблицы будут созданы через миграции TypeORM)

-- Настраиваем логирование
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Перезагружаем конфигурацию
SELECT pg_reload_conf();
