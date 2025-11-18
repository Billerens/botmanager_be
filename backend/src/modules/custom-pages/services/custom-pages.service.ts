import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  CustomPage,
  CustomPageStatus,
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

@Injectable()
export class CustomPagesService {
  constructor(
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>
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

    const customPage = this.customPageRepository.create({
      ...createDto,
      botId,
      status: createDto.status || CustomPageStatus.ACTIVE,
      isWebAppOnly: createDto.isWebAppOnly || false,
    });

    const savedPage = await this.customPageRepository.save(customPage);
    // Загружаем страницу с связью бота для корректного формирования URL
    const pageWithBot = await this.customPageRepository.findOne({
      where: { id: savedPage.id },
      relations: ["bot"],
    });
    return this.toResponseDto(pageWithBot!);
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

    await this.customPageRepository.remove(page);
  }

  private toResponseDto(page: CustomPage): CustomPageResponseDto {
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      description: page.description,
      content: page.content,
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
      content: page.content,
      botId: page.botId,
      botUsername: page.bot?.username || "unknown",
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      url: page.url,
      isWebAppOnly: page.isWebAppOnly,
    };
  }
}
