import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LangChainOpenRouterService } from "./langchain-openrouter.service";
import { LangChainOpenRouterController } from "./langchain-openrouter.controller";
import { ConversationMemoryService } from "./memory/conversation-memory.service";
import { ConversationMemoryController } from "./memory/conversation-memory.controller";
import { OpenRouterModule } from "../openrouter/openrouter.module";

/**
 * Модуль для работы с LangChain и OpenRouter
 *
 * Предоставляет:
 * - Интеграцию с LangChain для работы с LLM
 * - Поддержку OpenRouter как провайдера моделей
 * - REST API для взаимодействия с моделями
 * - Потоковую генерацию ответов
 * - Батч-обработку запросов
 * - Цепочки LangChain
 * - Управление памятью разговоров (conversation memory)
 */
@Module({
  imports: [ConfigModule, OpenRouterModule],
  controllers: [
    LangChainOpenRouterController,
    ConversationMemoryController,
  ],
  providers: [
    LangChainOpenRouterService,
    ConversationMemoryService,
  ],
  exports: [
    LangChainOpenRouterService,
    ConversationMemoryService,
  ],
})
export class LangChainOpenRouterModule {}

