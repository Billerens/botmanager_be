import { Injectable } from "@nestjs/common";
import { CustomPagesService } from "./custom-pages.service";

@Injectable()
export class CustomPagesBotService {
  constructor(private readonly customPagesService: CustomPagesService) {}

  /**
   * Обрабатывает команду /page {command} и возвращает URL страницы
   * @param botId ID бота
   * @param command Команда после /page
   * @returns URL страницы или null если страница не найдена
   */
  async getPageUrlByCommand(botId: string, command: string): Promise<string | null> {
    try {
      const page = await this.customPagesService.findByBotCommand(botId, command);
      return page ? page.url : null;
    } catch (error) {
      // Если страница не найдена, возвращаем null
      return null;
    }
  }

  /**
   * Генерирует inline клавиатуру для страниц бота
   * @param botId ID бота
   * @returns Массив кнопок для inline клавиатуры
   */
  async generatePageButtons(botId: string): Promise<Array<{ text: string; url: string }>> {
    try {
      const pages = await this.customPagesService.findAll(botId);
      return pages
        .filter(page => page.status === 'active')
        .map(page => ({
          text: page.title,
          url: page.url,
        }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Проверяет, существует ли команда для бота
   * @param botId ID бота
   * @param command Команда для проверки
   * @returns true если команда существует
   */
  async hasCommand(botId: string, command: string): Promise<boolean> {
    const url = await this.getPageUrlByCommand(botId, command);
    return url !== null;
  }
}
