@echo off
echo 🚀 Запуск инфраструктуры для разработки...

echo 📦 Запуск PostgreSQL, Redis и Mailhog...
npm run infra:up

echo ⏳ Ожидание запуска сервисов...
timeout /t 5 /nobreak > nul

echo ✅ Инфраструктура запущена!
echo.
echo 📊 Статус сервисов:
docker-compose ps
echo.
echo 🌐 Доступные сервисы:
echo   - PostgreSQL: localhost:5432
echo   - Redis: localhost:6379  
echo   - Mailhog: http://localhost:8025
echo.
echo 💡 Теперь запустите:
echo   - Backend: npm run dev:backend
echo   - Frontend: npm run dev:frontend
echo.
pause