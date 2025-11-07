import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Bot } from "../../../database/entities/bot.entity";
import { TelegramInitDataValidationService } from "../../../common/telegram-initdata-validation.service";
import { BotsService } from "../../bots/bots.service";

@Injectable()
export class TelegramInitDataGuard implements CanActivate {
  private readonly logger = new Logger(TelegramInitDataGuard.name);

  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    private initDataValidationService: TelegramInitDataValidationService,
    private botsService: BotsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const botId = request.params?.botId || request.params?.id;

    if (!botId) {
      this.logger.warn("botId не найден в параметрах запроса");
      throw new UnauthorizedException("botId обязателен");
    }

    // Извлекаем initData из заголовка или query параметра
    const initData =
      request.headers["x-telegram-init-data"] ||
      request.query?.initData ||
      request.body?.initData;

    if (!initData) {
      this.logger.warn("initData не найден в запросе");
      throw new UnauthorizedException("initData обязателен");
    }

    // Находим бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      this.logger.warn(`Бот с ID ${botId} не найден`);
      throw new UnauthorizedException("Бот не найден");
    }

    // Расшифровываем токен бота
    let botToken: string;
    try {
      botToken = this.botsService.decryptToken(bot.token);
    } catch (error) {
      this.logger.error("Ошибка расшифровки токена бота:", error);
      throw new UnauthorizedException("Ошибка валидации");
    }

    // Валидируем initData
    const validatedData = this.initDataValidationService.validateInitData(
      initData,
      botToken
    );

    if (!validatedData) {
      this.logger.warn("Валидация initData не прошла");
      throw new UnauthorizedException("Неверный или устаревший initData");
    }

    // Сохраняем валидированные данные в request для использования в контроллере
    request.telegramInitData = validatedData;
    request.telegramUsername = validatedData.user?.username;

    return true;
  }
}
