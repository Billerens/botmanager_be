@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:main
cls
echo ========================================
echo   BotManager Development Environment
echo ========================================
echo.
echo Выберите конфигурацию для запуска:
echo.
echo 1. Базовые сервисы (PostgreSQL + Redis)
echo 2. С инструментами разработки (+ pgAdmin + Redis Commander)
echo 3. С системой логирования (+ Loki + Grafana)
echo 4. Полная конфигурация (все сервисы)
echo 5. Показать статус сервисов
echo 6. Остановить все сервисы
echo 7. Перезапустить сервисы
echo 8. Показать логи
echo 9. Выход
echo.
set /p choice="Введите номер (1-9): "

if "%choice%"=="1" goto basic
if "%choice%"=="2" goto tools
if "%choice%"=="3" goto logging
if "%choice%"=="4" goto full
if "%choice%"=="5" goto status
if "%choice%"=="6" goto stop
if "%choice%"=="7" goto restart
if "%choice%"=="8" goto logs
if "%choice%"=="9" goto exit
goto invalid

:basic
cls
echo ========================================
echo   Запуск базовых сервисов
echo ========================================
echo.
echo Запускаем PostgreSQL и Redis...
docker-compose up -d postgres-dev redis-dev
call :check_success "базовые сервисы"
goto menu

:tools
cls
echo ========================================
echo   Запуск с инструментами разработки
echo ========================================
echo.
echo Запускаем PostgreSQL, Redis, pgAdmin и Redis Commander...
docker-compose --profile tools up -d
call :check_success "сервисы с инструментами разработки"
goto menu

:logging
cls
echo ========================================
echo   Запуск с системой логирования
echo ========================================
echo.
echo Запускаем PostgreSQL, Redis, Loki и Grafana...
docker-compose --profile logging up -d
call :check_success "сервисы с системой логирования"
goto menu

:full
cls
echo ========================================
echo   Запуск полной конфигурации
echo ========================================
echo.
echo Запускаем все сервисы...
docker-compose --profile tools --profile logging up -d
call :check_success "все сервисы"
goto menu

:status
cls
echo ========================================
echo   Статус сервисов
echo ========================================
echo.
docker-compose ps
echo.
echo Нажмите любую клавишу для возврата в меню...
pause >nul
goto menu

:stop
cls
echo ========================================
echo   Остановка сервисов
echo ========================================
echo.
echo Останавливаем все сервисы...
docker-compose down
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Все сервисы остановлены!
) else (
    echo.
    echo ❌ Ошибка при остановке сервисов!
)
echo.
echo Нажмите любую клавишу для возврата в меню...
pause >nul
goto menu

:restart
cls
echo ========================================
echo   Перезапуск сервисов
echo ========================================
echo.
echo Останавливаем сервисы...
docker-compose down
echo.
echo Запускаем сервисы заново...
docker-compose --profile tools --profile logging up -d
call :check_success "все сервисы (перезапуск)"
goto menu

:logs
cls
echo ========================================
echo   Логи сервисов
echo ========================================
echo.
echo Выберите сервис для просмотра логов:
echo.
echo 1. PostgreSQL
echo 2. Redis
echo 3. pgAdmin
echo 4. Redis Commander
echo 5. Loki
echo 6. Grafana
echo 7. Все сервисы
echo 8. Назад в главное меню
echo.
set /p log_choice="Введите номер (1-8): "

if "%log_choice%"=="1" docker-compose logs -f postgres-dev
if "%log_choice%"=="2" docker-compose logs -f redis-dev
if "%log_choice%"=="3" docker-compose logs -f pgadmin-dev
if "%log_choice%"=="4" docker-compose logs -f redis-commander-dev
if "%log_choice%"=="5" docker-compose logs -f loki-dev
if "%log_choice%"=="6" docker-compose logs -f grafana-dev
if "%log_choice%"=="7" docker-compose logs -f
if "%log_choice%"=="8" goto menu
goto logs

:check_success
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ %1 запущены успешно!
    echo.
    call :show_connection_info
) else (
    echo.
    echo ❌ Ошибка при запуске %1!
    echo Проверьте, что Docker запущен и попробуйте снова.
)
echo.
echo Нажмите любую клавишу для возврата в меню...
pause >nul
goto menu

:show_connection_info
echo 🔗 Информация о подключении:
echo.
echo   PostgreSQL: localhost:5432
echo   Redis: localhost:6379 (пароль: botmanager_redis_password)
echo.
docker-compose ps | findstr "Up" >nul
if %ERRORLEVEL% EQU 0 (
    echo   pgAdmin: http://localhost:5050
    echo     Email: admin@botmanager.dev
    echo     Password: admin123
    echo.
    echo   Redis Commander: http://localhost:8081
    echo     Username: admin
    echo     Password: admin123
    echo.
    echo   Loki: http://localhost:3100
    echo   Grafana: http://localhost:3002
    echo     Username: admin
    echo     Password: admin123
)

:menu
echo.
echo Нажмите любую клавишу для возврата в главное меню...
pause >nul
goto main

:invalid
echo.
echo ❌ Неверный выбор! Пожалуйста, введите число от 1 до 9.
echo.
echo Нажмите любую клавишу для продолжения...
pause >nul
goto main

:exit
echo.
echo До свидания! 👋
exit /b 0