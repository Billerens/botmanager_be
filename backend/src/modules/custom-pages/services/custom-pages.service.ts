import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import {
  CustomPage,
  CustomPageStatus,
  CustomPageType,
} from "../../../database/entities/custom-page.entity";
import { Bot } from "../../../database/entities/bot.entity";
import {
  CreateCustomPageDto,
  UpdateCustomPageDto,
} from "../dto/custom-page.dto";
import {
  CustomPageResponseDto,
  PublicCustomPageResponseDto,
} from "../dto/custom-page-response.dto";
import { UploadService } from "../../upload/upload.service";
import { TelegramService } from "../../telegram/telegram.service";
import { NotificationService } from "../../websocket/services/notification.service";
import { NotificationType } from "../../websocket/interfaces/notification.interface";

@Injectable()
export class CustomPagesService {
  constructor(
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    private readonly uploadService: UploadService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly notificationService: NotificationService
  ) {}

  async create(
    botId: string,
    userId: string,
    createDto: CreateCustomPageDto
  ): Promise<CustomPageResponseDto> {
    // Проверяем, существует ли бот
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException(`Бот с ID ${botId} не найден`);
    }

    // Проверяем уникальность slug для этого бота
    const existingPage = await this.customPageRepository.findOne({
      where: { botId, slug: createDto.slug },
    });
    if (existingPage) {
      throw new ConflictException(
        `Страница с slug "${createDto.slug}" уже существует для этого бота`
      );
    }

    // Если указана botCommand, проверяем её уникальность для бота
    if (createDto.botCommand) {
      const existingCommand = await this.customPageRepository.findOne({
        where: { botId, botCommand: createDto.botCommand },
      });
      if (existingCommand) {
        throw new ConflictException(
          `Команда "${createDto.botCommand}" уже используется другой страницей`
        );
      }
    }

    // Определяем тип страницы
    const pageType = createDto.pageType || CustomPageType.INLINE;

    // Для inline режима контент обязателен
    if (pageType === CustomPageType.INLINE && !createDto.content) {
      throw new BadRequestException(
        "Контент страницы обязателен для inline режима"
      );
    }

    const customPage = this.customPageRepository.create({
      ...createDto,
      botId,
      pageType,
      status: createDto.status || CustomPageStatus.ACTIVE,
      isWebAppOnly: createDto.isWebAppOnly || false,
      entryPoint: createDto.entryPoint || "index.html",
    });

    const savedPage = await this.customPageRepository.save(customPage);
    // Загружаем страницу с связью бота для корректного формирования URL
    const pageWithBot = await this.customPageRepository.findOne({
      where: { id: savedPage.id },
      relations: ["bot"],
    });

    // Если указана botCommand, обновляем команды бота
    if (createDto.botCommand) {
      await this.updateBotCommands(botId);
    }

    // Отправляем уведомление о создании страницы
    this.notificationService
      .sendToUser(userId, NotificationType.CUSTOM_PAGE_CREATED, {
        botId,
        customPage: {
          id: pageWithBot!.id,
          slug: pageWithBot!.slug,
          title: pageWithBot!.title,
          status: pageWithBot!.status,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления о создании custom page:",
          error
        );
      });

    return this.toResponseDto(pageWithBot!);
  }

  /**
   * Загружает ZIP-архив для static страницы
   */
  async uploadBundle(
    botId: string,
    pageId: string,
    zipBuffer: Buffer
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id: pageId, botId },
      relations: ["bot"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${pageId} не найдена`);
    }

    // Если у страницы уже есть бандл, удаляем его
    if (page.assets && page.assets.length > 0) {
      await this.uploadService.deleteCustomPageBundle(page.assets);
    }

    // Загружаем новый бандл
    const { staticPath, assets, entryPoint } =
      await this.uploadService.uploadCustomPageBundle(pageId, zipBuffer);

    // Обновляем страницу
    await this.customPageRepository.update(pageId, {
      pageType: CustomPageType.STATIC,
      staticPath,
      assets,
      entryPoint,
      content: null, // Очищаем inline контент
    });

    const updatedPage = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot"],
    });

    return this.toResponseDto(updatedPage!);
  }

  async findAll(botId: string): Promise<CustomPageResponseDto[]> {
    const pages = await this.customPageRepository.find({
      where: { botId },
      relations: ["bot"],
      order: { createdAt: "DESC" },
    });

    return pages.map((page) => this.toResponseDto(page));
  }

  async findOne(botId: string, id: string): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id, botId },
      relations: ["bot"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    return this.toResponseDto(page);
  }

  async findBySlug(
    botUsername: string,
    slug: string
  ): Promise<PublicCustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: {
        slug,
        bot: { username: botUsername },
        status: CustomPageStatus.ACTIVE,
      },
      relations: ["bot"],
    });

    if (!page) {
      throw new NotFoundException(`Страница не найдена`);
    }

    return this.toPublicResponseDto(page);
  }

  async findByBotCommand(
    botId: string,
    botCommand: string
  ): Promise<CustomPageResponseDto | null> {
    const page = await this.customPageRepository.findOne({
      where: { botId, botCommand, status: CustomPageStatus.ACTIVE },
      relations: ["bot"],
    });

    if (!page) {
      return null;
    }

    return this.toResponseDto(page);
  }

  async getPublicPageById(id: string): Promise<PublicCustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id, status: CustomPageStatus.ACTIVE },
      relations: ["bot"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    return this.toPublicResponseDto(page);
  }

  async update(
    botId: string,
    id: string,
    userId: string,
    updateDto: UpdateCustomPageDto
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id, botId },
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    // Проверяем уникальность slug при изменении
    if (updateDto.slug && updateDto.slug !== page.slug) {
      const existingPage = await this.customPageRepository.findOne({
        where: { botId, slug: updateDto.slug },
      });
      if (existingPage) {
        throw new ConflictException(
          `Страница с slug "${updateDto.slug}" уже существует для этого бота`
        );
      }
    }

    // Проверяем уникальность botCommand при изменении
    if (updateDto.botCommand && updateDto.botCommand !== page.botCommand) {
      const existingCommand = await this.customPageRepository.findOne({
        where: { botId, botCommand: updateDto.botCommand },
      });
      if (existingCommand) {
        throw new ConflictException(
          `Команда "${updateDto.botCommand}" уже используется другой страницей`
        );
      }
    }

    // Если тип страницы меняется с STATIC на другой тип, удаляем связанные файлы
    if (
      updateDto.pageType &&
      updateDto.pageType !== CustomPageType.STATIC &&
      page.pageType === CustomPageType.STATIC &&
      page.assets &&
      page.assets.length > 0
    ) {
      await this.uploadService.deleteCustomPageBundle(page.assets);
      // Очищаем поля связанные с файлами в базе данных
      await this.customPageRepository.update(id, {
        staticPath: null,
        assets: null,
      });
    }

    // Проверяем, нужно ли обновлять команды бота
    const needUpdateCommands =
      updateDto.botCommand !== undefined || // botCommand изменился (включая удаление)
      updateDto.status !== undefined || // статус изменился
      updateDto.showInMenu !== undefined; // видимость в меню изменилась

    await this.customPageRepository.update(id, updateDto);
    const updatedPage = await this.customPageRepository.findOne({
      where: { id },
      relations: ["bot"],
    });

    // Обновляем команды бота если изменились botCommand или status
    if (needUpdateCommands) {
      await this.updateBotCommands(botId);
    }

    // Отправляем уведомление об обновлении страницы
    this.notificationService
      .sendToUser(userId, NotificationType.CUSTOM_PAGE_UPDATED, {
        botId,
        customPage: {
          id: updatedPage!.id,
          slug: updatedPage!.slug,
          title: updatedPage!.title,
          status: updatedPage!.status,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об обновлении custom page:",
          error
        );
      });

    return this.toResponseDto(updatedPage!);
  }

  async remove(botId: string, id: string, userId: string): Promise<void> {
    const page = await this.customPageRepository.findOne({
      where: { id, botId },
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    // Запоминаем, была ли у страницы команда (для обновления меню бота)
    const hadBotCommand = !!page.botCommand;

    // Если это static страница с файлами, удаляем их из S3
    if (
      page.pageType === CustomPageType.STATIC &&
      page.assets &&
      page.assets.length > 0
    ) {
      await this.uploadService.deleteCustomPageBundle(page.assets);
    }

    // Отправляем уведомление об удалении страницы
    this.notificationService
      .sendToUser(userId, NotificationType.CUSTOM_PAGE_DELETED, {
        botId,
        customPage: {
          id: page.id,
          slug: page.slug,
          title: page.title,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об удалении custom page:",
          error
        );
      });

    await this.customPageRepository.remove(page);

    // Обновляем команды бота, если удалённая страница имела команду
    if (hadBotCommand) {
      await this.updateBotCommands(botId);
    }
  }

  private toResponseDto(page: CustomPage): CustomPageResponseDto {
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      description: page.description,
      pageType: page.pageType,
      content: page.content,
      staticPath: page.staticPath,
      entryPoint: page.entryPoint,
      assets: page.assets,
      staticUrl: page.staticUrl,
      status: page.status,
      isWebAppOnly: page.isWebAppOnly,
      botCommand: page.botCommand,
      showInMenu: page.showInMenu,
      botId: page.botId,
      botUsername: page.bot?.username || "unknown",
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      url: page.url,
    };
  }

  private toPublicResponseDto(page: CustomPage): PublicCustomPageResponseDto {
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      description: page.description,
      pageType: page.pageType,
      content: page.content,
      staticUrl: page.staticUrl,
      entryPoint: page.entryPoint,
      botId: page.botId,
      botUsername: page.bot?.username || "unknown",
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      url: page.url,
      isWebAppOnly: page.isWebAppOnly,
    };
  }

  /**
   * Обновляет команды бота в Telegram после изменений в CustomPages
   * @param botId ID бота
   */
  private async updateBotCommands(botId: string): Promise<void> {
    try {
      const bot = await this.botRepository.findOne({ where: { id: botId } });
      if (!bot || !bot.token) {
        console.warn(
          `Не удалось обновить команды бота ${botId}: бот не найден или отсутствует токен`
        );
        return;
      }

      const decryptedToken = this.decryptToken(bot.token);
      const success = await this.telegramService.setBotCommands(
        decryptedToken,
        bot
      );
      if (success) {
        console.log(
          `Команды бота ${botId} обновлены после изменения CustomPages`
        );
      }
      // Если success === false, ошибка уже залогирована в telegramService
    } catch (error) {
      console.error(
        `Ошибка при обновлении команд бота ${botId}:`,
        error.message
      );
      // Не бросаем ошибку, чтобы не прерывать основную операцию
    }
  }

  /**
   * Расшифровка токена бота (копия из BotsService)
   */
  private decryptToken(encryptedToken: string): string {
    const algorithm = "aes-256-cbc";
    const keyString =
      process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
    const key = crypto.scryptSync(keyString, "salt", 32);

    const parts = encryptedToken.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
