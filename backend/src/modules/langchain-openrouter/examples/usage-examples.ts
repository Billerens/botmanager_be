/**
 * Примеры использования LangChain OpenRouter Service
 * 
 * Это файл с примерами - НЕ запускайте его напрямую!
 * Используйте код из примеров в своих сервисах/контроллерах
 */

import { LangChainOpenRouterService } from '../langchain-openrouter.service';
import { ConversationMemoryService } from '../memory/conversation-memory.service';
import { MessageRole } from '../dto/langchain-chat.dto';

// ============================================
// Пример 1: Простой текстовый запрос
// ============================================
export async function simpleTextExample(service: LangChainOpenRouterService) {
  const response = await service.simplePrompt({
    prompt: 'Расскажи интересный факт о JavaScript',
    systemPrompt: 'Ты - эксперт по программированию',
    parameters: {
      temperature: 0.7,
      maxTokens: 500,
    },
  });

  console.log('Ответ:', response.content);
  console.log('Использовано токенов:', response.metadata.usage?.totalTokens);
  console.log('Время генерации:', response.metadata.generationTime, 'сек');
}

// ============================================
// Пример 2: Чат с историей сообщений
// ============================================
export async function chatWithHistoryExample(service: LangChainOpenRouterService) {
  const response = await service.chat({
    messages: [
      {
        role: MessageRole.SYSTEM,
        content: 'Ты - дружелюбный помощник, который отвечает кратко и по делу',
      },
      {
        role: MessageRole.HUMAN,
        content: 'Привет! Как тебя зовут?',
      },
      {
        role: MessageRole.AI,
        content: 'Привет! Я AI-ассистент. Чем могу помочь?',
      },
      {
        role: MessageRole.HUMAN,
        content: 'Объясни, что такое async/await в JavaScript',
      },
    ],
    model: 'anthropic/claude-3.5-sonnet',
    parameters: {
      temperature: 0.5,
      maxTokens: 1000,
    },
    sessionId: 'user_123_session',
  });

  console.log('Ответ:', response.content);
}

// ============================================
// Пример 3: Потоковая генерация
// ============================================
export async function streamingExample(service: LangChainOpenRouterService) {
  const stream = service.chatStream({
    messages: [
      {
        role: MessageRole.HUMAN,
        content: 'Напиши небольшую историю о космических путешествиях',
      },
    ],
    parameters: {
      temperature: 0.9, // Больше креативности
      maxTokens: 1000,
    },
  });

  console.log('Получение потока данных:');
  for await (const chunk of stream) {
    process.stdout.write(chunk); // Выводим чанки по мере поступления
  }
  console.log('\n\nГенерация завершена!');
}

// ============================================
// Пример 4: Батч-обработка запросов
// ============================================
export async function batchProcessingExample(service: LangChainOpenRouterService) {
  const requests = [
    {
      messages: [
        { role: MessageRole.HUMAN, content: 'Что такое TypeScript?' },
      ],
    },
    {
      messages: [
        { role: MessageRole.HUMAN, content: 'Что такое React?' },
      ],
    },
    {
      messages: [
        { role: MessageRole.HUMAN, content: 'Что такое Node.js?' },
      ],
    },
  ];

  console.log('Обработка 3 запросов параллельно...');
  const startTime = Date.now();

  const responses = await service.batchProcess(requests);

  const endTime = Date.now();
  console.log(`Обработано за ${(endTime - startTime) / 1000} сек`);

  responses.forEach((response, index) => {
    console.log(`\nОтвет ${index + 1}:`, response.content.substring(0, 100), '...');
  });
}

// ============================================
// Пример 5: Работа с памятью разговоров
// ============================================
export async function conversationMemoryExample(
  chatService: LangChainOpenRouterService,
  memoryService: ConversationMemoryService,
) {
  const sessionId = 'user_456_session';

  // Добавляем сообщения в историю
  await memoryService.addMessage(sessionId, {
    role: MessageRole.HUMAN,
    content: 'Привет! Меня зовут Алиса',
  });

  await memoryService.addMessage(sessionId, {
    role: MessageRole.AI,
    content: 'Привет, Алиса! Рад познакомиться. Чем могу помочь?',
  });

  // Получаем историю
  const history = await memoryService.getMessages(sessionId);
  console.log(`История содержит ${history.length} сообщений`);

  // Используем историю в новом запросе
  const response = await chatService.chat({
    messages: [
      ...history.map((msg) => ({
        role: msg._getType() === 'human' ? MessageRole.HUMAN : MessageRole.AI,
        content: msg.content as string,
      })),
      {
        role: MessageRole.HUMAN,
        content: 'Ты помнишь, как меня зовут?',
      },
    ],
    sessionId,
  });

  console.log('Ответ:', response.content);

  // Получаем статистику
  const stats = memoryService.getStats();
  console.log('Статистика памяти:', stats);

  // Очищаем сессию
  // await memoryService.clearSession(sessionId);
}

// ============================================
// Пример 6: Использование разных моделей
// ============================================
export async function differentModelsExample(service: LangChainOpenRouterService) {
  const prompt = 'Объясни теорию относительности простыми словами';

  // GPT-4 от OpenAI
  const gpt4Response = await service.simplePrompt({
    prompt,
    model: 'openai/gpt-4-turbo-preview',
    parameters: { temperature: 0.7 },
  });

  console.log('GPT-4:', gpt4Response.content.substring(0, 100), '...');

  // Claude от Anthropic
  const claudeResponse = await service.simplePrompt({
    prompt,
    model: 'anthropic/claude-3.5-sonnet',
    parameters: { temperature: 0.7 },
  });

  console.log('Claude:', claudeResponse.content.substring(0, 100), '...');

  // Llama от Meta
  const llamaResponse = await service.simplePrompt({
    prompt,
    model: 'meta-llama/llama-3.3-70b-instruct',
    parameters: { temperature: 0.7 },
  });

  console.log('Llama:', llamaResponse.content.substring(0, 100), '...');
}

// ============================================
// Пример 7: Обработка ошибок
// ============================================
export async function errorHandlingExample(service: LangChainOpenRouterService) {
  try {
    const response = await service.chat({
      messages: [
        {
          role: MessageRole.HUMAN,
          content: 'Привет!',
        },
      ],
      parameters: {
        temperature: 0.7,
        maxTokens: 1000000, // Слишком много токенов
      },
    });

    console.log(response.content);
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.data);
    } else if (error.message) {
      console.error('Error:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// ============================================
// Пример 8: Сложный сценарий с цепочкой
// ============================================
export async function complexChainExample(service: LangChainOpenRouterService) {
  // Первый запрос - генерируем идею
  const ideaResponse = await service.simplePrompt({
    prompt: 'Предложи тему для статьи о программировании',
    parameters: { temperature: 0.8 },
  });

  console.log('Идея:', ideaResponse.content);

  // Второй запрос - создаем план статьи на основе идеи
  const outlineResponse = await service.chat({
    messages: [
      {
        role: MessageRole.SYSTEM,
        content: 'Ты - редактор технического блога',
      },
      {
        role: MessageRole.HUMAN,
        content: `Создай подробный план статьи на тему: ${ideaResponse.content}`,
      },
    ],
    parameters: { temperature: 0.6 },
  });

  console.log('План статьи:', outlineResponse.content);

  // Третий запрос - пишем введение
  const introResponse = await service.chat({
    messages: [
      {
        role: MessageRole.SYSTEM,
        content: 'Ты - технический писатель',
      },
      {
        role: MessageRole.HUMAN,
        content: `Напиши увлекательное введение для статьи:\n${outlineResponse.content}`,
      },
    ],
    parameters: { temperature: 0.7 },
  });

  console.log('Введение:', introResponse.content);
}

// ============================================
// Пример 9: Экспорт и импорт сессии
// ============================================
export async function exportImportExample(memoryService: ConversationMemoryService) {
  const sessionId = 'backup_session';

  // Добавляем сообщения
  await memoryService.addMessage(sessionId, {
    role: MessageRole.HUMAN,
    content: 'Важное сообщение 1',
  });

  await memoryService.addMessage(sessionId, {
    role: MessageRole.AI,
    content: 'Ответ 1',
  });

  // Экспортируем
  const exportedData = await memoryService.exportSession(sessionId);
  console.log('Экспортировано:', JSON.stringify(exportedData, null, 2));

  // Очищаем
  await memoryService.clearSession(sessionId);

  // Импортируем обратно
  await memoryService.importSession(sessionId, exportedData);
  console.log('Сессия восстановлена!');

  const info = memoryService.getSessionInfo(sessionId);
  console.log('Информация о сессии:', info);
}

// ============================================
// Пример 10: Тонкая настройка параметров
// ============================================
export async function fineTuningExample(service: LangChainOpenRouterService) {
  // Для креативных задач
  const creativeResponse = await service.simplePrompt({
    prompt: 'Придумай оригинальное название для стартапа в области AI',
    parameters: {
      temperature: 1.2, // Высокая креативность
      topP: 0.95,
      frequencyPenalty: 0.5, // Меньше повторений
      presencePenalty: 0.5,
    },
  });

  console.log('Креативный ответ:', creativeResponse.content);

  // Для точных ответов
  const preciseResponse = await service.simplePrompt({
    prompt: 'Сколько будет 234 * 567?',
    parameters: {
      temperature: 0.1, // Низкая креативность
      topP: 0.5,
      maxTokens: 50,
    },
  });

  console.log('Точный ответ:', preciseResponse.content);
}

// ============================================
// ИСПОЛЬЗОВАНИЕ В ВАШЕМ КОДЕ
// ============================================

/*
import { Injectable } from '@nestjs/common';
import { LangChainOpenRouterService, ConversationMemoryService } from './modules/langchain-openrouter';

@Injectable()
export class YourService {
  constructor(
    private readonly langchainService: LangChainOpenRouterService,
    private readonly memoryService: ConversationMemoryService,
  ) {}

  async yourMethod() {
    // Используйте любой пример выше
    await simpleTextExample(this.langchainService);
  }
}
*/

