import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import * as crypto from "crypto";
import {
  CustomPage,
  CustomPageStatus,
  CustomPageType,
} from "../../../database/entities/custom-page.entity";
import { Bot } from "../../../database/entities/bot.entity";
import { Shop } from "../../../database/entities/shop.entity";
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
  private readonly logger = new Logger(CustomPagesService.name);

  constructor(
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    private readonly uploadService: UploadService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly notificationService: NotificationService
  ) {}

  // ============================================================
  // CRUD операции
  // ============================================================

  /**
   * Создание новой страницы
   */
  async create(
    userId: string,
    createDto: CreateCustomPageDto
  ): Promise<CustomPageResponseDto> {
    // Проверяем глобальную уникальность slug (если указан)
    if (createDto.slug) {
      const existingSlug = await this.customPageRepository.findOne({
        where: { slug: createDto.slug },
      });
      if (existingSlug) {
        throw new ConflictException(
          `Страница с slug "${createDto.slug}" уже существует`
        );
      }
    }

    // Определяем botId и shopId с учётом синхронизации связей
    let botId: string | undefined = createDto.botId;
    let shopId: string | undefined = createDto.shopId;

    // Если указан botId - проверяем права и синхронизируем с магазином
    if (botId) {
      const bot = await this.botRepository.findOne({ where: { id: botId } });
      if (!bot) {
        throw new NotFoundException(`Бот с ID ${botId} не найден`);
      }
      if (bot.ownerId !== userId) {
        throw new ForbiddenException("Нет прав доступа к этому боту");
      }

      // Проверяем уникальность botCommand для этого бота
      if (createDto.botCommand) {
        const existingCommand = await this.customPageRepository.findOne({
          where: { botId, botCommand: createDto.botCommand },
        });
        if (existingCommand) {
          throw new ConflictException(
            `Команда "${createDto.botCommand}" уже используется другой страницей этого бота`
          );
        }
      }

      // Синхронизация: если у бота есть магазин - привязываем и к нему
      const linkedShop = await this.shopRepository.findOne({
        where: { botId },
      });
      if (linkedShop) {
        shopId = linkedShop.id;
      }
    }

    // Если указан shopId (и не был установлен через бота) - проверяем права и синхронизируем
    if (createDto.shopId && !botId) {
      const shop = await this.shopRepository.findOne({
        where: { id: createDto.shopId },
      });
      if (!shop) {
        throw new NotFoundException(
          `Магазин с ID ${createDto.shopId} не найден`
        );
      }
      if (shop.ownerId !== userId) {
        throw new ForbiddenException("Нет прав доступа к этому магазину");
      }

      shopId = shop.id;

      // Синхронизация: если у магазина есть бот - привязываем и к нему
      if (shop.botId) {
        botId = shop.botId;

        // Проверяем уникальность botCommand для бота
        if (createDto.botCommand) {
          const existingCommand = await this.customPageRepository.findOne({
            where: { botId, botCommand: createDto.botCommand },
          });
          if (existingCommand) {
            throw new ConflictException(
              `Команда "${createDto.botCommand}" уже используется другой страницей бота`
            );
          }
        }
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
      title: createDto.title,
      slug: createDto.slug || null,
      description: createDto.description,
      pageType,
      content: createDto.content,
      entryPoint: createDto.entryPoint || "index.html",
      status: createDto.status || CustomPageStatus.ACTIVE,
      isWebAppOnly: createDto.isWebAppOnly || false,
      botCommand: createDto.botCommand,
      showInMenu: createDto.showInMenu ?? true,
      ownerId: userId,
      botId: botId || null,
      shopId: shopId || null,
    });

    const savedPage = await this.customPageRepository.save(customPage);

    // Загружаем страницу со всеми связями
    const pageWithRelations = await this.customPageRepository.findOne({
      where: { id: savedPage.id },
      relations: ["bot", "shop"],
    });

    // Если привязана к боту и есть команда, обновляем команды бота
    if (botId && createDto.botCommand) {
      await this.updateBotCommands(botId);
    }

    // Отправляем уведомление
    this.sendNotification(userId, NotificationType.CUSTOM_PAGE_CREATED, {
      customPage: {
        id: pageWithRelations!.id,
        slug: pageWithRelations!.slug,
        title: pageWithRelations!.title,
        status: pageWithRelations!.status,
      },
    });

    return this.toResponseDto(pageWithRelations!);
  }

  /**
   * Получить все страницы пользователя
   */
  async findAllByOwner(userId: string): Promise<CustomPageResponseDto[]> {
    const pages = await this.customPageRepository.find({
      where: { ownerId: userId },
      relations: ["bot", "shop"],
      order: { createdAt: "DESC" },
    });

    return pages.map((page) => this.toResponseDto(page));
  }

  /**
   * Получить страницы по боту
   */
  async findAllByBot(
    botId: string,
    userId: string
  ): Promise<CustomPageResponseDto[]> {
    // Проверяем права доступа к боту
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException(`Бот с ID ${botId} не найден`);
    }
    if (bot.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этому боту");
    }

    const pages = await this.customPageRepository.find({
      where: { botId },
      relations: ["bot", "shop"],
      order: { createdAt: "DESC" },
    });

    return pages.map((page) => this.toResponseDto(page));
  }

  /**
   * Получить страницы по магазину
   */
  async findAllByShop(
    shopId: string,
    userId: string
  ): Promise<CustomPageResponseDto[]> {
    // Проверяем права доступа к магазину
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException(`Магазин с ID ${shopId} не найден`);
    }
    if (shop.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этому магазину");
    }

    const pages = await this.customPageRepository.find({
      where: { shopId },
      relations: ["bot", "shop"],
      order: { createdAt: "DESC" },
    });

    return pages.map((page) => this.toResponseDto(page));
  }

  /**
   * Получить страницу по ID
   */
  async findOne(id: string, userId: string): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
    }

    return this.toResponseDto(page);
  }

  /**
   * Обновить страницу
   */
  async update(
    id: string,
    userId: string,
    updateDto: UpdateCustomPageDto
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
    }

    // Проверяем глобальную уникальность slug при изменении
    if (updateDto.slug !== undefined && updateDto.slug !== page.slug) {
      if (updateDto.slug !== null) {
        const existingSlug = await this.customPageRepository.findOne({
          where: { slug: updateDto.slug },
        });
        if (existingSlug && existingSlug.id !== id) {
          throw new ConflictException(
            `Страница с slug "${updateDto.slug}" уже существует`
          );
        }
      }
    }

    // Обрабатываем изменение привязки к боту
    let newBotId = page.botId;
    let newShopId = page.shopId;
    const oldBotId = page.botId;

    if (updateDto.botId !== undefined) {
      if (updateDto.botId === null) {
        // Отвязка от бота
        newBotId = null;
      } else if (updateDto.botId !== page.botId) {
        // Привязка к новому боту
        const result = await this.resolveBindings(
          updateDto.botId,
          null,
          userId
        );
        newBotId = result.botId;
        newShopId = result.shopId;

        // Проверяем уникальность botCommand для нового бота
        if (page.botCommand || updateDto.botCommand) {
          const command = updateDto.botCommand ?? page.botCommand;
          if (command) {
            const existingCommand = await this.customPageRepository.findOne({
              where: { botId: newBotId, botCommand: command },
            });
            if (existingCommand && existingCommand.id !== id) {
              throw new ConflictException(
                `Команда "${command}" уже используется другой страницей этого бота`
              );
            }
          }
        }
      }
    }

    // Обрабатываем изменение привязки к магазину (если botId не был изменён)
    if (updateDto.shopId !== undefined && updateDto.botId === undefined) {
      if (updateDto.shopId === null) {
        // Отвязка от магазина
        newShopId = null;
      } else if (updateDto.shopId !== page.shopId) {
        // Привязка к новому магазину
        const result = await this.resolveBindings(
          null,
          updateDto.shopId,
          userId
        );
        newBotId = result.botId ?? newBotId;
        newShopId = result.shopId;

        // Проверяем уникальность botCommand для бота (если есть)
        if (result.botId && (page.botCommand || updateDto.botCommand)) {
          const command = updateDto.botCommand ?? page.botCommand;
          if (command) {
            const existingCommand = await this.customPageRepository.findOne({
              where: { botId: result.botId, botCommand: command },
            });
            if (existingCommand && existingCommand.id !== id) {
              throw new ConflictException(
                `Команда "${command}" уже используется другой страницей бота`
              );
            }
          }
        }
      }
    }

    // Проверяем уникальность botCommand при изменении (для текущего бота)
    if (
      updateDto.botCommand !== undefined &&
      updateDto.botCommand !== page.botCommand &&
      newBotId
    ) {
      const existingCommand = await this.customPageRepository.findOne({
        where: { botId: newBotId, botCommand: updateDto.botCommand },
      });
      if (existingCommand && existingCommand.id !== id) {
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
      await this.customPageRepository.update(id, {
        staticPath: null,
        assets: null,
      });
    }

    // Формируем объект обновления
    const updateData: Partial<CustomPage> = {};

    if (updateDto.title !== undefined) updateData.title = updateDto.title;
    if (updateDto.slug !== undefined) updateData.slug = updateDto.slug;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description;
    if (updateDto.pageType !== undefined)
      updateData.pageType = updateDto.pageType;
    if (updateDto.content !== undefined) updateData.content = updateDto.content;
    if (updateDto.entryPoint !== undefined)
      updateData.entryPoint = updateDto.entryPoint;
    if (updateDto.status !== undefined) updateData.status = updateDto.status;
    if (updateDto.isWebAppOnly !== undefined)
      updateData.isWebAppOnly = updateDto.isWebAppOnly;
    if (updateDto.botCommand !== undefined)
      updateData.botCommand = updateDto.botCommand;
    if (updateDto.showInMenu !== undefined)
      updateData.showInMenu = updateDto.showInMenu;

    // Обновляем привязки
    if (newBotId !== page.botId) updateData.botId = newBotId;
    if (newShopId !== page.shopId) updateData.shopId = newShopId;

    if (Object.keys(updateData).length > 0) {
      await this.customPageRepository.update(id, updateData);
    }

    const updatedPage = await this.customPageRepository.findOne({
      where: { id },
      relations: ["bot", "shop"],
    });

    // Обновляем команды ботов при необходимости
    const needUpdateCommands =
      updateDto.botCommand !== undefined ||
      updateDto.status !== undefined ||
      updateDto.showInMenu !== undefined ||
      newBotId !== oldBotId;

    if (needUpdateCommands) {
      // Обновляем команды старого бота (если был)
      if (oldBotId && oldBotId !== newBotId) {
        await this.updateBotCommands(oldBotId);
      }
      // Обновляем команды нового/текущего бота (если есть)
      if (newBotId) {
        await this.updateBotCommands(newBotId);
      }
    }

    // Отправляем уведомление
    this.sendNotification(userId, NotificationType.CUSTOM_PAGE_UPDATED, {
      customPage: {
        id: updatedPage!.id,
        slug: updatedPage!.slug,
        title: updatedPage!.title,
        status: updatedPage!.status,
      },
    });

    return this.toResponseDto(updatedPage!);
  }

  /**
   * Удалить страницу
   */
  async remove(id: string, userId: string): Promise<void> {
    const page = await this.customPageRepository.findOne({
      where: { id },
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
    }

    const hadBotCommand = !!page.botCommand;
    const botId = page.botId;

    // Удаляем файлы из S3 если это static страница
    if (
      page.pageType === CustomPageType.STATIC &&
      page.assets &&
      page.assets.length > 0
    ) {
      await this.uploadService.deleteCustomPageBundle(page.assets);
    }

    // Отправляем уведомление
    this.sendNotification(userId, NotificationType.CUSTOM_PAGE_DELETED, {
      customPage: {
        id: page.id,
        slug: page.slug,
        title: page.title,
      },
    });

    await this.customPageRepository.remove(page);

    // Обновляем команды бота
    if (hadBotCommand && botId) {
      await this.updateBotCommands(botId);
    }
  }

  // ============================================================
  // Загрузка бандла
  // ============================================================

  /**
   * Загружает ZIP-архив для static страницы
   */
  async uploadBundle(
    pageId: string,
    userId: string,
    zipBuffer: Buffer
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${pageId} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
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
      content: null,
    });

    const updatedPage = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    return this.toResponseDto(updatedPage!);
  }

  // ============================================================
  // Привязка/отвязка
  // ============================================================

  /**
   * Привязать страницу к боту
   */
  async assignToBot(
    pageId: string,
    botId: string,
    userId: string
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${pageId} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
    }

    const { botId: newBotId, shopId: newShopId } = await this.resolveBindings(
      botId,
      null,
      userId
    );

    // Проверяем уникальность botCommand
    if (page.botCommand) {
      const existingCommand = await this.customPageRepository.findOne({
        where: { botId: newBotId, botCommand: page.botCommand },
      });
      if (existingCommand && existingCommand.id !== pageId) {
        throw new ConflictException(
          `Команда "${page.botCommand}" уже используется другой страницей этого бота`
        );
      }
    }

    const oldBotId = page.botId;

    await this.customPageRepository.update(pageId, {
      botId: newBotId,
      shopId: newShopId,
    });

    // Обновляем команды ботов
    if (oldBotId && oldBotId !== newBotId) {
      await this.updateBotCommands(oldBotId);
    }
    if (newBotId) {
      await this.updateBotCommands(newBotId);
    }

    const updatedPage = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    return this.toResponseDto(updatedPage!);
  }

  /**
   * Привязать страницу к магазину
   */
  async assignToShop(
    pageId: string,
    shopId: string,
    userId: string
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${pageId} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
    }

    const { botId: newBotId, shopId: newShopId } = await this.resolveBindings(
      null,
      shopId,
      userId
    );

    // Проверяем уникальность botCommand (если бот привязывается)
    if (newBotId && page.botCommand) {
      const existingCommand = await this.customPageRepository.findOne({
        where: { botId: newBotId, botCommand: page.botCommand },
      });
      if (existingCommand && existingCommand.id !== pageId) {
        throw new ConflictException(
          `Команда "${page.botCommand}" уже используется другой страницей бота`
        );
      }
    }

    const oldBotId = page.botId;

    await this.customPageRepository.update(pageId, {
      botId: newBotId,
      shopId: newShopId,
    });

    // Обновляем команды ботов
    if (oldBotId && oldBotId !== newBotId) {
      await this.updateBotCommands(oldBotId);
    }
    if (newBotId && newBotId !== oldBotId) {
      await this.updateBotCommands(newBotId);
    }

    const updatedPage = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    return this.toResponseDto(updatedPage!);
  }

  /**
   * Отвязать страницу от бота
   */
  async unassignFromBot(
    pageId: string,
    userId: string
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${pageId} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
    }

    const oldBotId = page.botId;

    await this.customPageRepository.update(pageId, {
      botId: null,
    });

    // Обновляем команды старого бота
    if (oldBotId) {
      await this.updateBotCommands(oldBotId);
    }

    const updatedPage = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    return this.toResponseDto(updatedPage!);
  }

  /**
   * Отвязать страницу от магазина
   */
  async unassignFromShop(
    pageId: string,
    userId: string
  ): Promise<CustomPageResponseDto> {
    const page = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${pageId} не найдена`);
    }

    if (page.ownerId !== userId) {
      throw new ForbiddenException("Нет прав доступа к этой странице");
    }

    await this.customPageRepository.update(pageId, {
      shopId: null,
    });

    const updatedPage = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    return this.toResponseDto(updatedPage!);
  }

  // ============================================================
  // Публичные методы
  // ============================================================

  /**
   * Получить публичную страницу по ID или slug
   */
  async getPublicPage(
    identifier: string
  ): Promise<PublicCustomPageResponseDto> {
    // Определяем, это UUID или slug
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    let page: CustomPage | null;

    if (isUuid) {
      page = await this.customPageRepository.findOne({
        where: { id: identifier, status: CustomPageStatus.ACTIVE },
        relations: ["bot", "shop"],
      });
    } else {
      page = await this.customPageRepository.findOne({
        where: { slug: identifier, status: CustomPageStatus.ACTIVE },
        relations: ["bot", "shop"],
      });
    }

    if (!page) {
      throw new NotFoundException("Страница не найдена");
    }

    return this.toPublicResponseDto(page);
  }

  /**
   * Получить страницу по команде бота (для обработки команд в Telegram)
   */
  async findByBotCommand(
    botId: string,
    botCommand: string
  ): Promise<CustomPageResponseDto | null> {
    const page = await this.customPageRepository.findOne({
      where: { botId, botCommand, status: CustomPageStatus.ACTIVE },
      relations: ["bot", "shop"],
    });

    if (!page) {
      return null;
    }

    return this.toResponseDto(page);
  }

  // ============================================================
  // Вспомогательные методы
  // ============================================================

  /**
   * Разрешает привязки с учётом синхронизации Bot ↔ Shop
   */
  private async resolveBindings(
    botId: string | null,
    shopId: string | null,
    userId: string
  ): Promise<{ botId: string | null; shopId: string | null }> {
    let resolvedBotId = botId;
    let resolvedShopId = shopId;

    if (botId) {
      const bot = await this.botRepository.findOne({ where: { id: botId } });
      if (!bot) {
        throw new NotFoundException(`Бот с ID ${botId} не найден`);
      }
      if (bot.ownerId !== userId) {
        throw new ForbiddenException("Нет прав доступа к этому боту");
      }

      // Синхронизация: если у бота есть магазин - привязываем и к нему
      const linkedShop = await this.shopRepository.findOne({
        where: { botId },
      });
      if (linkedShop) {
        resolvedShopId = linkedShop.id;
      }
    }

    if (shopId && !botId) {
      const shop = await this.shopRepository.findOne({ where: { id: shopId } });
      if (!shop) {
        throw new NotFoundException(`Магазин с ID ${shopId} не найден`);
      }
      if (shop.ownerId !== userId) {
        throw new ForbiddenException("Нет прав доступа к этому магазину");
      }

      resolvedShopId = shop.id;

      // Синхронизация: если у магазина есть бот - привязываем и к нему
      if (shop.botId) {
        resolvedBotId = shop.botId;
      }
    }

    return { botId: resolvedBotId, shopId: resolvedShopId };
  }

  /**
   * Обновляет команды бота в Telegram
   */
  private async updateBotCommands(botId: string): Promise<void> {
    try {
      const bot = await this.botRepository.findOne({ where: { id: botId } });
      if (!bot || !bot.token) {
        this.logger.warn(
          `Не удалось обновить команды бота ${botId}: бот не найден или отсутствует токен`
        );
        return;
      }

      const shop = await this.shopRepository.findOne({
        where: { botId },
      });

      const decryptedToken = this.decryptToken(bot.token);
      const success = await this.telegramService.setBotCommands(
        decryptedToken,
        bot,
        shop
      );

      if (success) {
        this.logger.log(`Команды бота ${botId} обновлены`);
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при обновлении команд бота ${botId}: ${error.message}`
      );
    }
  }

  /**
   * Отправляет уведомление пользователю
   */
  private sendNotification(
    userId: string,
    type: NotificationType,
    data: Record<string, any>
  ): void {
    this.notificationService.sendToUser(userId, type, data).catch((error) => {
      this.logger.error(`Ошибка отправки уведомления: ${error.message}`);
    });
  }

  /**
   * Расшифровка токена бота
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

  /**
   * Преобразование в DTO ответа
   */
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
      ownerId: page.ownerId,
      botId: page.botId,
      botUsername: page.bot?.username,
      botName: page.bot?.name,
      shopId: page.shopId,
      shopName: page.shop?.name,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      url: page.url,
    };
  }

  /**
   * Преобразование в публичный DTO ответа
   */
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
      botUsername: page.bot?.username,
      shopId: page.shopId,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      url: page.url,
      isWebAppOnly: page.isWebAppOnly,
    };
  }
}
