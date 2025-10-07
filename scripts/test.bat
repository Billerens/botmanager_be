@echo off
REM Скрипт для запуска тестов в Windows
echo 🧪 Запуск тестов BotManager...

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

REM Останавливаем существующие тестовые контейнеры
echo 🛑 Останавливаем существующие тестовые контейнеры...
docker-compose -f docker-compose.test.yml down

REM Собираем и запускаем тестовые контейнеры
echo 🔨 Собираем и запускаем тестовые контейнеры...
docker-compose -f docker-compose.test.yml up --build -d

REM Ждем запуска сервисов
echo ⏳ Ждем запуска сервисов...
timeout /t 10 /nobreak >nul

REM Запускаем тесты
echo 🧪 Запускаем тесты...
docker-compose -f docker-compose.test.yml exec backend_test npm run test

REM Останавливаем тестовые контейнеры
echo 🛑 Останавливаем тестовые контейнеры...
docker-compose -f docker-compose.test.yml down

echo.
echo ✅ Тесты завершены!
echo.
pause
