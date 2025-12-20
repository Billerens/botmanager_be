import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  CustomPage,
  CustomPageStatus,
} from "../../../database/entities/custom-page.entity";

/**
 * Сервис для работы с кастомными страницами в контексте бота.
 * Используется для генерации команд и кнопок в Telegram.
 * Не требует проверки прав доступа (внутренний сервис).
 */
@Injectable()
export class CustomPagesBotService {
  constructor(
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>
  ) {}

  /**
   * Обрабатывает команду и возвращает URL страницы
   * @param botId ID бота
   * @param command Команда (например, "contacts")
   * @returns URL страницы или null если страница не найдена
   */
  async getPageUrlByCommand(
    botId: string,
    command: string
  ): Promise<string | null> {
    try {
      const page = await this.customPageRepository.findOne({
        where: {
          botId,
          botCommand: command,
          status: CustomPageStatus.ACTIVE,
        },
      });

      return page ? page.url : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Генерирует inline клавиатуру для страниц бота
   * @param botId ID бота
   * @returns Массив кнопок для inline клавиатуры
   */
  async generatePageButtons(
    botId: string
  ): Promise<Array<{ text: string; url: string }>> {
    try {
      const pages = await this.customPageRepository.find({
        where: {
          botId,
          status: CustomPageStatus.ACTIVE,
        },
      });

      return pages.map((page) => ({
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

  /**
   * Генерирует список команд для меню бота в Telegram
   * @param botId ID бота
   * @returns Массив команд для setMyCommands API
   */
  async generateBotCommands(
    botId: string
  ): Promise<Array<{ command: string; description: string }>> {
    try {
      const pages = await this.customPageRepository.find({
        where: {
          botId,
          status: CustomPageStatus.ACTIVE,
        },
      });

      return pages
        .filter((page) => page.botCommand && page.showInMenu)
        .map((page) => ({
          // Убираем / если команда начинается с неё
          command: page.botCommand!.startsWith("/")
            ? page.botCommand!.substring(1)
            : page.botCommand!,
          description: `📄 ${page.title}`,
        }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Получает все активные страницы бота
   * @param botId ID бота
   * @returns Список страниц
   */
  async getActivePagesForBot(botId: string): Promise<CustomPage[]> {
    return this.customPageRepository.find({
      where: {
        botId,
        status: CustomPageStatus.ACTIVE,
      },
      order: { createdAt: "DESC" },
    });
  }
}
