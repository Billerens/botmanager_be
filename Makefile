.PHONY: help install dev dev:backend dev:frontend test clean logs status stop

# OS detection
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
else
    DETECTED_OS := Unix
endif

help: ## Показать справку
	@echo ""
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Операционная система: $(DETECTED_OS)"
	@echo ""

install: ## Установить все зависимости
	@echo "📦 Установка зависимостей..."
	@npm run install

dev: ## Запустить инфраструктуру для разработки
	@echo "🚀 Запуск инфраструктуры..."
	@npm run infra:up

dev:backend: ## Запустить только backend
	@echo "🔧 Запуск backend..."
	@cd backend && npm run start:dev

dev:frontend: ## Запустить только frontend
	@echo "🎨 Запуск frontend..."
	@cd frontend && npm run dev

test: ## Запустить тесты
	@echo "🧪 Запуск тестов..."
	@npm run test

clean: ## Очистить контейнеры и данные
	@echo "🧹 Очистка контейнеров и данных..."
	@npm run infra:clean

logs: ## Просмотреть логи инфраструктуры
	@echo "📄 Просмотр логов..."
	@npm run infra:logs

status: ## Показать статус контейнеров
	@echo "📊 Статус контейнеров..."
	@docker-compose ps

stop: ## Остановить инфраструктуру
	@echo "🛑 Остановка инфраструктуры..."
	@npm run infra:down