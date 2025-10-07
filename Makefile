.PHONY: help install dev test build start lint format migration

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

install: ## Установить зависимости backend
	@echo "📦 Установка зависимостей..."
	@npm run install

dev: ## Запустить backend в режиме разработки
	@echo "🚀 Запуск backend в режиме разработки..."
	@npm run dev

build: ## Собрать backend
	@echo "🔨 Сборка backend..."
	@npm run build

start: ## Запустить backend в production режиме
	@echo "🚀 Запуск backend..."
	@npm run start

test: ## Запустить тесты
	@echo "🧪 Запуск тестов..."
	@npm run test

test:e2e: ## Запустить e2e тесты
	@echo "🧪 Запуск e2e тестов..."
	@npm run test:e2e

test:cov: ## Запустить тесты с покрытием
	@echo "🧪 Запуск тестов с покрытием..."
	@npm run test:cov

lint: ## Проверить код линтером
	@echo "🔍 Проверка кода..."
	@npm run lint

format: ## Форматировать код
	@echo "✨ Форматирование кода..."
	@npm run format

migration:generate: ## Создать новую миграцию
	@echo "📝 Создание миграции..."
	@npm run migration:generate

migration:run: ## Применить миграции
	@echo "📝 Применение миграций..."
	@npm run migration:run

migration:revert: ## Откатить последнюю миграцию
	@echo "📝 Откат миграции..."
	@npm run migration:revert