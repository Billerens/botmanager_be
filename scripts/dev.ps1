# PowerShell скрипт для запуска разработки
Write-Host "🚀 Запуск BotManager в режиме разработки..." -ForegroundColor Green

# Проверяем наличие Docker
try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
} catch {
    Write-Host "❌ Docker или Docker Compose не установлен. Установите Docker Desktop и попробуйте снова." -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Останавливаем существующие контейнеры
Write-Host "🛑 Останавливаем существующие контейнеры..." -ForegroundColor Yellow
docker-compose down

# Собираем и запускаем контейнеры
Write-Host "🔨 Собираем и запускаем контейнеры..." -ForegroundColor Yellow
docker-compose up --build -d

# Ждем запуска сервисов
Write-Host "⏳ Ждем запуска сервисов..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Проверяем статус
Write-Host "📊 Статус сервисов:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "✅ BotManager запущен в режиме разработки!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Frontend: http://localhost:3001" -ForegroundColor Blue
Write-Host "🔧 Backend API: http://localhost:3000" -ForegroundColor Blue
Write-Host "📧 Mailhog: http://localhost:8025" -ForegroundColor Blue
Write-Host "🗄️  PostgreSQL: localhost:5432" -ForegroundColor Blue
Write-Host "🔴 Redis: localhost:6379" -ForegroundColor Blue
Write-Host ""
Write-Host "📝 Логи: docker-compose logs -f" -ForegroundColor Gray
Write-Host "🛑 Остановка: docker-compose down" -ForegroundColor Gray
Write-Host ""

# Открываем браузер
$response = Read-Host "Открыть браузер? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Start-Process "http://localhost:3001"
}
