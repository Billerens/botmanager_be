import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository, SelectQueryBuilder } from "typeorm";

import {
  StylePreset,
  StylePresetStatus,
} from "../../database/entities/style-preset.entity";
import { CreateStylePresetDto } from "./dto/create-style-preset.dto";
import { UpdateStylePresetDto } from "./dto/update-style-preset.dto";
import { GalleryQueryDto } from "./dto/gallery-query.dto";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";

const MAX_PRESETS_PER_USER = 10;

const MAX_CSS_DATA_SIZE = 750 * 1024; // 750 KB

@Injectable()
export class StylePresetsService {
  constructor(
    @InjectRepository(StylePreset)
    private presetRepository: Repository<StylePreset>,
    private notificationService: NotificationService,
  ) {}

  // ===== Валидация cssData =====

  private validateCssData(cssData: string): void {
    if (!cssData || typeof cssData !== "string") {
      throw new BadRequestException("cssData обязателен");
    }
    const size = Buffer.byteLength(cssData, "utf8");
    if (size > MAX_CSS_DATA_SIZE) {
      throw new BadRequestException(
        `cssData превышает максимальный размер (${Math.round(size / 1024)}KB > 750KB)`,
      );
    }
  }

  // ===== Пользовательские операции =====

  /** Галерея: published пресеты с поиском и фильтрами */
  async getGallery(query: GalleryQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.presetRepository
      .createQueryBuilder("p")
      .leftJoin("p.author", "author")
      .addSelect([
        "author.firstName",
        "author.lastName",
        "author.telegramUsername",
      ])
      .where("p.status = :status", { status: StylePresetStatus.PUBLISHED })
      .andWhere("p.authorId IS NULL"); // Показываем только системные копии

    this.applyGalleryFilters(qb, query);
    this.applyGallerySorting(qb, query.sortBy);

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: items.map((item) => this.toGalleryListItem(item)),
      total,
      page,
      limit,
    };
  }

  /** Детали пресета из галереи (включает cssData) */
  async getGalleryItem(id: string) {
    const preset = await this.presetRepository.findOne({
      where: { id, status: StylePresetStatus.PUBLISHED },
      relations: ["author"],
    });
    if (!preset) {
      throw new NotFoundException("Пресет не найден в галерее");
    }
    return preset;
  }

  /** Мои пресеты — лёгкий список без cssData */
  async getMyPresets(userId: string) {
    const presets = await this.presetRepository
      .createQueryBuilder("p")
      .select([
        "p.id",
        "p.name",
        "p.description",
        "p.target",
        "p.tags",
        "p.status",
        "p.isPlatformChoice",
        "p.rejectionReason",
        "p.deletionRequestReason",
        "p.usageCount",
        "p.sortOrder",
        "p.createdAt",
        "p.updatedAt",
        "p.publishedAt",
        // cssData НЕ выбирается — только по запросу /my/:id
      ])
      .where("p.authorId = :userId", { userId })
      .andWhere("p.status != :archived", { archived: StylePresetStatus.ARCHIVED })
      .orderBy("p.updatedAt", "DESC")
      .getMany();
    return presets;
  }

  /** Мой пресет — полный объект с cssData (для применения) */
  async getMyPresetById(userId: string, id: string): Promise<StylePreset> {
    const preset = await this.presetRepository.findOne({
      where: { id, authorId: userId },
    });
    if (!preset) {
      throw new NotFoundException("Пресет не найден или вам не принадлежит");
    }
    return preset;
  }

  /** Создать пресет */
  async create(userId: string, dto: CreateStylePresetDto): Promise<StylePreset> {
    // Архивированные пресеты не занимают квоту
    const count = await this.presetRepository.count({

      where: { authorId: userId, status: Not(StylePresetStatus.ARCHIVED) },
    });
    if (count >= MAX_PRESETS_PER_USER) {
      throw new BadRequestException(
        `Достигнут лимит: ${MAX_PRESETS_PER_USER} активных пресетов на пользователя. Архивируйте ненужные пресеты, чтобы освободить место.`,
      );
    }

    this.validateCssData(dto.cssData);

    const preset = this.presetRepository.create({
      name: dto.name,
      description: dto.description,
      target: dto.target,
      tags: dto.tags || [],
      cssData: dto.cssData,
      status: (dto.initialStatus as StylePresetStatus) || StylePresetStatus.DRAFT,
      authorId: userId,
    });

    return this.presetRepository.save(preset);
  }

  /** Обновить свой пресет (только draft/private/rejected) */
  async update(
    userId: string,
    id: string,
    dto: UpdateStylePresetDto,
  ): Promise<StylePreset> {
    const preset = await this.findOwnPreset(userId, id);

    const editableStatuses = [
      StylePresetStatus.DRAFT,
      StylePresetStatus.PRIVATE,
      StylePresetStatus.REJECTED,
    ];
    if (!editableStatuses.includes(preset.status)) {
      throw new ForbiddenException(
        `Нельзя редактировать пресет в статусе "${preset.status}"`,
      );
    }

    if (dto.cssData !== undefined) {
      this.validateCssData(dto.cssData);
      preset.cssData = dto.cssData;
    }

    if (dto.name !== undefined) preset.name = dto.name;
    if (dto.description !== undefined) preset.description = dto.description;
    if (dto.target !== undefined) preset.target = dto.target;
    if (dto.tags !== undefined) preset.tags = dto.tags;

    return this.presetRepository.save(preset);
  }

  /** Архивировать свой пресет.
   * draft/private/rejected — удаляются напрямую.
   * published/pending_deletion — опубликованная копия в галерее (системная) остаётся,
   * поэтому пользователь может свободно убрать свой оригинал, освободив квоту.
   */
  async archive(userId: string, id: string): Promise<void> {
    const preset = await this.findOwnPreset(userId, id);

    const archivableStatuses = [
      StylePresetStatus.DRAFT,
      StylePresetStatus.PRIVATE,
      StylePresetStatus.REJECTED,
      StylePresetStatus.PUBLISHED,
      StylePresetStatus.PENDING_DELETION,
    ];
    if (!archivableStatuses.includes(preset.status)) {
      throw new ForbiddenException(
        `Нельзя архивировать пресет в статусе "${preset.status}"`,
      );
    }

    preset.status = StylePresetStatus.ARCHIVED;
    preset.archivedAt = new Date();
    await this.presetRepository.save(preset);
  }

  /** Отправить на модерацию */
  async publish(userId: string, id: string): Promise<StylePreset> {
    const preset = await this.findOwnPreset(userId, id);

    const publishableStatuses = [
      StylePresetStatus.DRAFT,
      StylePresetStatus.PRIVATE,
      StylePresetStatus.REJECTED,
    ];
    if (!publishableStatuses.includes(preset.status)) {
      throw new ForbiddenException(
        `Нельзя отправить на модерацию из статуса "${preset.status}"`,
      );
    }

    preset.status = StylePresetStatus.PENDING_REVIEW;
    preset.rejectionReason = null;
    return this.presetRepository.save(preset);
  }

  /** Запросить удаление published пресета */
  async requestDeletion(
    userId: string,
    id: string,
    reason?: string,
  ): Promise<StylePreset> {
    const preset = await this.findOwnPreset(userId, id);

    if (preset.status !== StylePresetStatus.PUBLISHED) {
      throw new ForbiddenException(
        "Запрос на удаление доступен только для опубликованных пресетов",
      );
    }

    preset.status = StylePresetStatus.PENDING_DELETION;
    preset.deletionRequestReason = reason || null;
    return this.presetRepository.save(preset);
  }

  /** Зафиксировать применение (usageCount++) */
  async trackApply(id: string): Promise<void> {
    await this.presetRepository.increment({ id }, "usageCount", 1);
  }

  // ===== Админ операции =====

  /** Админ: все пресеты с фильтрами */
  async adminGetAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: StylePresetStatus;
    target?: string;
    authorId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;

    const qb = this.presetRepository
      .createQueryBuilder("p")
      .leftJoin("p.author", "author")
      .addSelect([
        "author.id",
        "author.firstName",
        "author.lastName",
        "author.telegramUsername",
      ]);

    if (params.search) {
      qb.andWhere("(p.name ILIKE :search OR p.description ILIKE :search)", {
        search: `%${params.search}%`,
      });
    }
    if (params.status) {
      qb.andWhere("p.status = :status", { status: params.status });
    }
    if (params.target) {
      qb.andWhere("p.target = :target", { target: params.target });
    }
    if (params.authorId) {
      qb.andWhere("p.authorId = :authorId", { authorId: params.authorId });
    }

    qb.orderBy("p.createdAt", "DESC");

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Админ: получить по ID */
  async adminGetById(id: string): Promise<StylePreset> {
    const preset = await this.presetRepository.findOne({
      where: { id },
      relations: ["author"],
    });
    if (!preset) {
      throw new NotFoundException("Пресет не найден");
    }
    return preset;
  }

  /** Админ: создать системный пресет (authorId = null) */
  async adminCreate(dto: CreateStylePresetDto): Promise<StylePreset> {
    this.validateCssData(dto.cssData);

    const preset = this.presetRepository.create({
      name: dto.name,
      description: dto.description,
      target: dto.target,
      tags: dto.tags || [],
      cssData: dto.cssData,
      status: StylePresetStatus.PUBLISHED,
      authorId: null,
      publishedAt: new Date(),
    });

    return this.presetRepository.save(preset);
  }

  /** Админ: обновить любой пресет */
  async adminUpdate(id: string, dto: UpdateStylePresetDto): Promise<StylePreset> {
    const preset = await this.adminGetById(id);

    if (dto.cssData !== undefined) {
      this.validateCssData(dto.cssData);
      preset.cssData = dto.cssData;
    }

    if (dto.name !== undefined) preset.name = dto.name;
    if (dto.description !== undefined) preset.description = dto.description;
    if (dto.target !== undefined) preset.target = dto.target;
    if (dto.tags !== undefined) preset.tags = dto.tags;

    return this.presetRepository.save(preset);
  }

  /** Админ: архивировать любой пресет */
  async adminArchive(id: string): Promise<void> {
    const preset = await this.adminGetById(id);
    preset.status = StylePresetStatus.ARCHIVED;
    preset.archivedAt = new Date();
    await this.presetRepository.save(preset);
  }

  /** Админ: одобрить публикацию.
   * При одобрении создаётся СИСТЕМНАЯ КОПИЯ пресета (authorId = null).
   * Это гарантирует, что галерея не зависит от оригинального аккаунта:
   * пользователь может удалить свой пресет, освободив квоту, а копия
   * останется публично доступной.
   */
  async approve(id: string): Promise<StylePreset> {
    const preset = await this.adminGetById(id);
    if (preset.status !== StylePresetStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Можно одобрить только пресет со статусом "pending_review", текущий: "${preset.status}"`,
      );
    }

    // 1. Обновляем оригинал пользователя
    preset.status = StylePresetStatus.PUBLISHED;
    preset.publishedAt = new Date();
    preset.rejectionReason = null;
    const saved = await this.presetRepository.save(preset);

    // 2. Создаём системную копию (authorId = null)
    const author = preset.author;
    const authorName = author
      ? `${author.firstName || ""} ${author.lastName || ""}`.trim() ||
        author.telegramUsername ||
        null
      : null;

    const systemCopy = this.presetRepository.create({
      name: saved.name,
      description: saved.description,
      target: saved.target,
      tags: saved.tags,
      cssData: saved.cssData,
      status: StylePresetStatus.PUBLISHED,
      isPlatformChoice: saved.isPlatformChoice,
      authorId: null, // системный — не привязан к пользователю
      originalAuthorName: authorName, // Сохраняем имя автора
      sortOrder: saved.sortOrder,
      publishedAt: saved.publishedAt,
    });
    await this.presetRepository.save(systemCopy);

    // 3. Уведомляем автора
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.STYLE_PRESET_APPROVED,
        `Ваш пресет «${saved.name}» одобрен и опубликован в галерее. Вы можете удалить свою копию, чтобы освободить место в лимите.`,
        { presetId: saved.id, presetName: saved.name },
      );
    }
    return saved;
  }

  /** Админ: отклонить публикацию */
  async reject(id: string, reason: string): Promise<StylePreset> {
    const preset = await this.adminGetById(id);
    if (preset.status !== StylePresetStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Можно отклонить только пресет со статусом "pending_review", текущий: "${preset.status}"`,
      );
    }
    preset.status = StylePresetStatus.REJECTED;
    preset.rejectionReason = reason;
    const saved = await this.presetRepository.save(preset);
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.STYLE_PRESET_REJECTED,
        `Ваш пресет «${saved.name}» отклонён. Причина: ${reason}`,
        { presetId: saved.id, presetName: saved.name, reason },
      );
    }
    return saved;
  }

  /** Админ: одобрить удаление */
  async approveDeletion(id: string): Promise<StylePreset> {
    const preset = await this.adminGetById(id);
    if (preset.status !== StylePresetStatus.PENDING_DELETION) {
      throw new BadRequestException(
        `Одобрить удаление можно только для статуса "pending_deletion"`,
      );
    }
    preset.status = StylePresetStatus.ARCHIVED;
    preset.archivedAt = new Date();
    const saved = await this.presetRepository.save(preset);
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.STYLE_PRESET_DELETION_APPROVED,
        `Ваш запрос на удаление пресета «${saved.name}» одобрен`,
        { presetId: saved.id, presetName: saved.name },
      );
    }
    return saved;
  }

  /** Админ: отклонить удаление */
  async rejectDeletion(id: string, reason?: string): Promise<StylePreset> {
    const preset = await this.adminGetById(id);
    if (preset.status !== StylePresetStatus.PENDING_DELETION) {
      throw new BadRequestException(
        `Отклонить удаление можно только для статуса "pending_deletion"`,
      );
    }
    preset.status = StylePresetStatus.PUBLISHED;
    preset.deletionRequestReason = null;
    const saved = await this.presetRepository.save(preset);
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.STYLE_PRESET_DELETION_REJECTED,
        reason
          ? `Запрос на удаление пресета «${saved.name}» отклонён. ${reason}`
          : `Запрос на удаление пресета «${saved.name}» отклонён`,
        { presetId: saved.id, presetName: saved.name, reason },
      );
    }
    return saved;
  }

  /** Админ: установить/снять isPlatformChoice */
  async setPlatformChoice(
    id: string,
    isPlatformChoice: boolean,
  ): Promise<StylePreset> {
    const preset = await this.adminGetById(id);
    preset.isPlatformChoice = isPlatformChoice;
    return this.presetRepository.save(preset);
  }

  // ===== Приватные хелперы =====

  private async notifyAuthor(
    userId: string,
    type: NotificationType,
    message: string,
    payload: { presetId: string; presetName: string; reason?: string },
  ): Promise<void> {
    try {
      await this.notificationService.sendToUser(userId, type, {
        message,
        ...payload,
      });
    } catch (err) {
      if (err?.message) {
        console.warn(
          `[StylePresetsService] Не удалось отправить уведомление автору ${userId}:`,
          err.message,
        );
      }
    }
  }

  private async findOwnPreset(userId: string, id: string): Promise<StylePreset> {
    const preset = await this.presetRepository.findOne({
      where: { id, authorId: userId },
    });
    if (!preset) {
      throw new NotFoundException("Пресет не найден или вам не принадлежит");
    }
    return preset;
  }

  private applyGalleryFilters(
    qb: SelectQueryBuilder<StylePreset>,
    query: GalleryQueryDto,
  ): void {
    if (query.search) {
      qb.andWhere(
        "(p.name ILIKE :search OR p.description ILIKE :search OR :searchTag = ANY(p.tags))",
        {
          search: `%${query.search}%`,
          searchTag: query.search.toLowerCase(),
        },
      );
    }
    if (query.target) {
      qb.andWhere("p.target = :target", { target: query.target });
    }
    if (query.tags && query.tags.length > 0) {
      qb.andWhere("p.tags && :tags", { tags: query.tags });
    }
    if (query.isPlatformChoice !== undefined) {
      qb.andWhere("p.isPlatformChoice = :isPlatformChoice", {
        isPlatformChoice: query.isPlatformChoice,
      });
    }
  }

  private applyGallerySorting(
    qb: SelectQueryBuilder<StylePreset>,
    sortBy?: string,
  ): void {
    // Всегда platformChoice вверху
    qb.addOrderBy("p.isPlatformChoice", "DESC");

    switch (sortBy) {
      case "popular":
        qb.addOrderBy("p.usageCount", "DESC");
        break;
      case "name":
        qb.addOrderBy("p.name", "ASC");
        break;
      case "newest":
      default:
        qb.addOrderBy("p.publishedAt", "DESC", "NULLS LAST");
        break;
    }
  }

  private toGalleryListItem(preset: StylePreset) {
    const author = preset.author;
    const authorName =
      preset.originalAuthorName ||
      (author
        ? `${author.firstName || ""} ${author.lastName || ""}`.trim() ||
          author.telegramUsername ||
          null
        : null);

    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      target: preset.target,
      tags: preset.tags,
      isPlatformChoice: preset.isPlatformChoice,
      usageCount: preset.usageCount,
      authorName,
      publishedAt: preset.publishedAt,
      // cssData НЕ включается в список — только при GET /gallery/:id
    };
  }

  /** Админ: ОКОНЧАТЕЛЬНОЕ удаление */
  async adminHardDelete(id: string): Promise<void> {
    await this.presetRepository.delete(id);
  }
}
