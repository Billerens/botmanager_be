import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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

@Injectable()
export class CustomPagesService {
  constructor(
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    private readonly uploadService: UploadService
  ) {}

  async create(
    botId: string,
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

    await this.customPageRepository.update(id, updateDto);
    const updatedPage = await this.customPageRepository.findOne({
      where: { id },
      relations: ["bot"],
    });

    return this.toResponseDto(updatedPage!);
  }

  async remove(botId: string, id: string): Promise<void> {
    const page = await this.customPageRepository.findOne({
      where: { id, botId },
    });

    if (!page) {
      throw new NotFoundException(`Страница с ID ${id} не найдена`);
    }

    // Если это static страница с файлами, удаляем их из S3
    if (
      page.pageType === CustomPageType.STATIC &&
      page.assets &&
      page.assets.length > 0
    ) {
      await this.uploadService.deleteCustomPageBundle(page.assets);
    }

    await this.customPageRepository.remove(page);
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
}
