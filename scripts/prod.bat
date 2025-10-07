@echo off
REM Скрипт для запуска production в Windows
echo 🚀 Запуск BotManager в production режиме...

REM Проверяем наличие .env файла
if not exist .env (
    echo ❌ Файл .env не найден. Скопируйте env.example в .env и настройте переменные.
    pause
    exit /b 1
)

REM Проверяем наличие Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker не установлен. Установите Docker и попробуйте снова.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова.
    pause
    exit /b 1
)

REM Останавливаем существующие контейнеры
echo 🛑 Останавливаем существующие контейнеры...
docker-compose -f docker-compose.prod.yml down

REM Собираем и запускаем контейнеры
echo 🔨 Собираем и запускаем контейнеры...
docker-compose -f docker-compose.prod.yml up --build -d

REM Ждем запуска сервисов
echo ⏳ Ждем запуска сервисов...
timeout /t 15 /nobreak >nul

REM Проверяем статус
echo 📊 Статус сервисов:
docker-compose -f docker-compose.prod.yml ps

echo.
echo ✅ BotManager запущен в production режиме!
echo.
echo 🌐 Frontend: http://localhost:3001
echo 🔧 Backend API: http://localhost:3000
echo 🗄️  PostgreSQL: localhost:5432
echo 🔴 Redis: localhost:6379
echo.
echo 📝 Логи: docker-compose -f docker-compose.prod.yml logs -f
echo 🛑 Остановка: docker-compose -f docker-compose.prod.yml down
echo.
pause
