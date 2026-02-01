#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для показа главного меню
show_menu() {
    clear
    echo -e "${BLUE}========================================"
    echo "   UForge Development Environment"
    echo "========================================${NC}"
    echo
    echo "Выберите конфигурацию для запуска:"
    echo
    echo "1. Базовые сервисы (PostgreSQL + Redis)"
    echo "2. С инструментами разработки (+ pgAdmin + Redis Commander)"
    echo "3. С системой логирования (+ Loki + Grafana)"
    echo "4. Полная конфигурация (все сервисы)"
    echo "5. Показать статус сервисов"
    echo "6. Остановить все сервисы"
    echo "7. Перезапустить сервисы"
    echo "8. Показать логи"
    echo "9. Выход"
    echo
}

# Функция для проверки успешности запуска
check_success() {
    if [ $? -eq 0 ]; then
        echo
        echo -e "${GREEN}✅ $1 запущены успешно!${NC}"
        echo
        show_connection_info
    else
        echo
        echo -e "${RED}❌ Ошибка при запуске $1!${NC}"
        echo "Проверьте, что Docker запущен и попробуйте снова."
    fi
    echo
    read -p "Нажмите Enter для возврата в меню..."
}

# Функция для показа информации о подключении
show_connection_info() {
    echo -e "${YELLOW}🔗 Информация о подключении:${NC}"
    echo
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis: localhost:6379"
    echo
    
    # Проверяем, какие сервисы запущены
    if docker-compose ps | grep -q "pgadmin-dev.*Up"; then
        echo "  pgAdmin: http://localhost:5050"
        echo "    Email: admin@botmanager.local"
        echo "    Password: admin123"
        echo
    fi
    
    if docker-compose ps | grep -q "redis-commander-dev.*Up"; then
        echo "  Redis Commander: http://localhost:8081"
        echo "    Username: admin"
        echo "    Password: admin123"
        echo
    fi
    
    if docker-compose ps | grep -q "loki-dev.*Up"; then
        echo "  Loki: http://localhost:3100"
    fi
    
    if docker-compose ps | grep -q "grafana-dev.*Up"; then
        echo "  Grafana: http://localhost:3002"
        echo "    Username: admin"
        echo "    Password: admin123"
    fi
}

# Функция для запуска базовых сервисов
start_basic() {
    clear
    echo -e "${BLUE}========================================"
    echo "   Запуск базовых сервисов"
    echo "========================================${NC}"
    echo
    echo "Запускаем PostgreSQL и Redis..."
    docker-compose up -d postgres-dev redis-dev
    check_success "базовые сервисы"
}

# Функция для запуска с инструментами
start_tools() {
    clear
    echo -e "${BLUE}========================================"
    echo "   Запуск с инструментами разработки"
    echo "========================================${NC}"
    echo
    echo "Запускаем PostgreSQL, Redis, pgAdmin и Redis Commander..."
    docker-compose --profile tools up -d
    check_success "сервисы с инструментами разработки"
}

# Функция для запуска с логированием
start_logging() {
    clear
    echo -e "${BLUE}========================================"
    echo "   Запуск с системой логирования"
    echo "========================================${NC}"
    echo
    echo "Запускаем PostgreSQL, Redis, Loki и Grafana..."
    docker-compose --profile logging up -d
    check_success "сервисы с системой логирования"
}

# Функция для запуска полной конфигурации
start_full() {
    clear
    echo -e "${BLUE}========================================"
    echo "   Запуск полной конфигурации"
    echo "========================================${NC}"
    echo
    echo "Запускаем все сервисы..."
    docker-compose --profile tools --profile logging up -d
    check_success "все сервисы"
}

# Функция для показа статуса
show_status() {
    clear
    echo -e "${BLUE}========================================"
    echo "   Статус сервисов"
    echo "========================================${NC}"
    echo
    docker-compose ps
    echo
    read -p "Нажмите Enter для возврата в меню..."
}

# Функция для остановки сервисов
stop_services() {
    clear
    echo -e "${BLUE}========================================"
    echo "   Остановка сервисов"
    echo "========================================${NC}"
    echo
    echo "Останавливаем все сервисы..."
    docker-compose down
    if [ $? -eq 0 ]; then
        echo
        echo -e "${GREEN}✅ Все сервисы остановлены!${NC}"
    else
        echo
        echo -e "${RED}❌ Ошибка при остановке сервисов!${NC}"
    fi
    echo
    read -p "Нажмите Enter для возврата в меню..."
}

# Функция для перезапуска сервисов
restart_services() {
    clear
    echo -e "${BLUE}========================================"
    echo "   Перезапуск сервисов"
    echo "========================================${NC}"
    echo
    echo "Останавливаем сервисы..."
    docker-compose down
    echo
    echo "Запускаем сервисы заново..."
    docker-compose --profile tools --profile logging up -d
    check_success "все сервисы (перезапуск)"
}

# Функция для показа логов
show_logs() {
    while true; do
        clear
        echo -e "${BLUE}========================================"
        echo "   Логи сервисов"
        echo "========================================${NC}"
        echo
        echo "Выберите сервис для просмотра логов:"
        echo
        echo "1. PostgreSQL"
        echo "2. Redis"
        echo "3. pgAdmin"
        echo "4. Redis Commander"
        echo "5. Loki"
        echo "6. Grafana"
        echo "7. Все сервисы"
        echo "8. Назад в главное меню"
        echo
        read -p "Введите номер (1-8): " log_choice
        
        case $log_choice in
            1) docker-compose logs -f postgres-dev ;;
            2) docker-compose logs -f redis-dev ;;
            3) docker-compose logs -f pgadmin-dev ;;
            4) docker-compose logs -f redis-commander-dev ;;
            5) docker-compose logs -f loki-dev ;;
            6) docker-compose logs -f grafana-dev ;;
            7) docker-compose logs -f ;;
            8) break ;;
            *) echo -e "${RED}❌ Неверный выбор!${NC}"; sleep 2 ;;
        esac
    done
}

# Главный цикл
while true; do
    show_menu
    read -p "Введите номер (1-9): " choice
    
    case $choice in
        1) start_basic ;;
        2) start_tools ;;
        3) start_logging ;;
        4) start_full ;;
        5) show_status ;;
        6) stop_services ;;
        7) restart_services ;;
        8) show_logs ;;
        9) 
            echo
            echo "До свидания! 👋"
            exit 0
            ;;
        *) 
            echo
            echo -e "${RED}❌ Неверный выбор! Пожалуйста, введите число от 1 до 9.${NC}"
            echo
            read -p "Нажмите Enter для продолжения..."
            ;;
    esac
done
