import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import {
  FlowTemplate,
  FlowTemplateStatus,
} from "../../database/entities/flow-template.entity";
import { CreateFlowTemplateDto } from "./dto/create-flow-template.dto";
import { UpdateFlowTemplateDto } from "./dto/update-flow-template.dto";
import { GalleryQueryDto } from "./dto/gallery-query.dto";
import { NotificationService } from "../websocket/services/notification.service";
import {
  NotificationType,
} from "../websocket/interfaces/notification.interface";

const MAX_TEMPLATES_PER_USER = 50;
const MAX_FLOW_DATA_SIZE = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class FlowTemplatesService {
  constructor(
    @InjectRepository(FlowTemplate)
    private templateRepository: Repository<FlowTemplate>,
    private notificationService: NotificationService,
  ) {}

  // ===== Валидация flowData =====

  private validateFlowData(flowData: any): void {
    if (!flowData || typeof flowData !== "object") {
      throw new BadRequestException("flowData обязателен");
    }

    const jsonSize = JSON.stringify(flowData).length;
    if (jsonSize > MAX_FLOW_DATA_SIZE) {
      throw new BadRequestException(
        `flowData превышает максимальный размер (${Math.round(jsonSize / 1024 / 1024)}MB > 5MB)`,
      );
    }

    if (!Array.isArray(flowData.nodes) || flowData.nodes.length === 0) {
      throw new BadRequestException(
        "flowData.nodes должен содержать хотя бы одну ноду",
      );
    }

    if (!Array.isArray(flowData.edges)) {
      throw new BadRequestException("flowData.edges должен быть массивом");
    }

    // Проверяем что каждая нода имеет id, type, position
    const nodeIds = new Set<string>();
    for (const node of flowData.nodes) {
      if (!node.id || typeof node.id !== "string") {
        throw new BadRequestException("Каждая нода должна иметь id (string)");
      }
      if (!node.type || typeof node.type !== "string") {
        throw new BadRequestException(`Нода ${node.id}: отсутствует type`);
      }
      if (
        !node.position ||
        typeof node.position.x !== "number" ||
        typeof node.position.y !== "number"
      ) {
        throw new BadRequestException(
          `Нода ${node.id}: отсутствует position {x, y}`,
        );
      }
      nodeIds.add(node.id);
    }

    // Проверяем что edges ссылаются на существующие ноды
    for (const edge of flowData.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new BadRequestException(
          `Edge ${edge.id}: source "${edge.source}" не найден среди нод`,
        );
      }
      if (!nodeIds.has(edge.target)) {
        throw new BadRequestException(
          `Edge ${edge.id}: target "${edge.target}" не найден среди нод`,
        );
      }
    }
  }

  // ===== Пользовательские операции =====

  /** Галерея: published темплейты с поиском и фильтрами */
  async getGallery(query: GalleryQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.templateRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.category", "category")
      .leftJoin("t.author", "author")
      .addSelect([
        "author.firstName",
        "author.lastName",
        "author.telegramUsername",
      ])
      .where("t.status = :status", { status: FlowTemplateStatus.PUBLISHED });

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

  /** Детали темплейта из галереи (включает flowData) */
  async getGalleryItem(id: string) {
    const template = await this.templateRepository.findOne({
      where: { id, status: FlowTemplateStatus.PUBLISHED },
      relations: ["category", "author"],
    });
    if (!template) {
      throw new NotFoundException("Темплейт не найден в галерее");
    }
    return template;
  }

  /** Мои темплейты (все статусы кроме archived) */
  async getMyTemplates(userId: string) {
    const templates = await this.templateRepository.find({
      where: { authorId: userId },
      relations: ["category"],
      order: { updatedAt: "DESC" },
    });
    return templates.filter((t) => t.status !== FlowTemplateStatus.ARCHIVED);
  }

  /** Создать темплейт */
  async create(
    userId: string,
    dto: CreateFlowTemplateDto,
  ): Promise<FlowTemplate> {
    // Лимит на количество темплейтов
    const count = await this.templateRepository.count({
      where: { authorId: userId },
    });
    if (count >= MAX_TEMPLATES_PER_USER) {
      throw new BadRequestException(
        `Достигнут лимит: ${MAX_TEMPLATES_PER_USER} темплейтов на пользователя`,
      );
    }

    this.validateFlowData(dto.flowData);

    const template = this.templateRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type,
      categoryId: dto.categoryId || null,
      tags: dto.tags || [],
      flowData: dto.flowData,
      status: dto.initialStatus || FlowTemplateStatus.DRAFT,
      authorId: userId,
      nodeCount: dto.flowData.nodes.length,
    });

    return this.templateRepository.save(template);
  }

  /** Обновить свой темплейт (только draft/private/rejected) */
  async update(
    userId: string,
    id: string,
    dto: UpdateFlowTemplateDto,
  ): Promise<FlowTemplate> {
    const template = await this.findOwnTemplate(userId, id);

    const editableStatuses = [
      FlowTemplateStatus.DRAFT,
      FlowTemplateStatus.PRIVATE,
      FlowTemplateStatus.REJECTED,
    ];
    if (!editableStatuses.includes(template.status)) {
      throw new ForbiddenException(
        `Нельзя редактировать темплейт в статусе "${template.status}"`,
      );
    }

    if (dto.flowData) {
      this.validateFlowData(dto.flowData);
      template.flowData = dto.flowData;
      template.nodeCount = dto.flowData.nodes.length;
    }

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.type !== undefined) template.type = dto.type;
    if (dto.categoryId !== undefined) template.categoryId = dto.categoryId;
    if (dto.tags !== undefined) template.tags = dto.tags;

    return this.templateRepository.save(template);
  }

  /** Архивировать свой темплейт (draft/private/rejected) */
  async archive(userId: string, id: string): Promise<void> {
    const template = await this.findOwnTemplate(userId, id);

    const archivableStatuses = [
      FlowTemplateStatus.DRAFT,
      FlowTemplateStatus.PRIVATE,
      FlowTemplateStatus.REJECTED,
    ];
    if (!archivableStatuses.includes(template.status)) {
      throw new ForbiddenException(
        `Нельзя удалить темплейт в статусе "${template.status}". Используйте "Запрос на удаление"`,
      );
    }

    template.status = FlowTemplateStatus.ARCHIVED;
    template.archivedAt = new Date();
    await this.templateRepository.save(template);
  }

  /** Отправить на модерацию */
  async publish(userId: string, id: string): Promise<FlowTemplate> {
    const template = await this.findOwnTemplate(userId, id);

    const publishableStatuses = [
      FlowTemplateStatus.DRAFT,
      FlowTemplateStatus.PRIVATE,
      FlowTemplateStatus.REJECTED,
    ];
    if (!publishableStatuses.includes(template.status)) {
      throw new ForbiddenException(
        `Нельзя отправить на модерацию из статуса "${template.status}"`,
      );
    }

    template.status = FlowTemplateStatus.PENDING_REVIEW;
    template.rejectionReason = null;
    return this.templateRepository.save(template);
  }

  /** Запросить удаление published темплейта */
  async requestDeletion(
    userId: string,
    id: string,
    reason?: string,
  ): Promise<FlowTemplate> {
    const template = await this.findOwnTemplate(userId, id);

    if (template.status !== FlowTemplateStatus.PUBLISHED) {
      throw new ForbiddenException(
        "Запрос на удаление доступен только для опубликованных темплейтов",
      );
    }

    template.status = FlowTemplateStatus.PENDING_DELETION;
    template.deletionRequestReason = reason || null;
    return this.templateRepository.save(template);
  }

  /** Зафиксировать применение (usageCount++) */
  async trackApply(id: string): Promise<void> {
    await this.templateRepository.increment({ id }, "usageCount", 1);
  }

  // ===== Админ операции =====

  /** Админ: все темплейты с фильтрами */
  async adminGetAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: FlowTemplateStatus;
    type?: string;
    categoryId?: string;
    authorId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;

    const qb = this.templateRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.category", "category")
      .leftJoin("t.author", "author")
      .addSelect([
        "author.id",
        "author.firstName",
        "author.lastName",
        "author.telegramUsername",
      ]);

    if (params.search) {
      qb.andWhere("(t.name ILIKE :search OR t.description ILIKE :search)", {
        search: `%${params.search}%`,
      });
    }
    if (params.status) {
      qb.andWhere("t.status = :status", { status: params.status });
    }
    if (params.type) {
      qb.andWhere("t.type = :type", { type: params.type });
    }
    if (params.categoryId) {
      qb.andWhere("t.categoryId = :categoryId", {
        categoryId: params.categoryId,
      });
    }
    if (params.authorId) {
      qb.andWhere("t.authorId = :authorId", { authorId: params.authorId });
    }

    qb.orderBy("t.createdAt", "DESC");

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
  async adminGetById(id: string): Promise<FlowTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ["category", "author"],
    });
    if (!template) {
      throw new NotFoundException("Темплейт не найден");
    }
    return template;
  }

  /** Админ: создать системный темплейт (authorId = null) */
  async adminCreate(dto: CreateFlowTemplateDto): Promise<FlowTemplate> {
    this.validateFlowData(dto.flowData);

    const template = this.templateRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type,
      categoryId: dto.categoryId || null,
      tags: dto.tags || [],
      flowData: dto.flowData,
      status: FlowTemplateStatus.PUBLISHED,
      authorId: null,
      nodeCount: dto.flowData.nodes.length,
      publishedAt: new Date(),
    });

    return this.templateRepository.save(template);
  }

  /** Админ: обновить любой темплейт */
  async adminUpdate(
    id: string,
    dto: UpdateFlowTemplateDto,
  ): Promise<FlowTemplate> {
    const template = await this.adminGetById(id);

    if (dto.flowData) {
      this.validateFlowData(dto.flowData);
      template.flowData = dto.flowData;
      template.nodeCount = dto.flowData.nodes.length;
    }

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.type !== undefined) template.type = dto.type;
    if (dto.categoryId !== undefined) template.categoryId = dto.categoryId;
    if (dto.tags !== undefined) template.tags = dto.tags;

    return this.templateRepository.save(template);
  }

  /** Админ: архивировать любой темплейт */
  async adminArchive(id: string): Promise<void> {
    const template = await this.adminGetById(id);
    template.status = FlowTemplateStatus.ARCHIVED;
    template.archivedAt = new Date();
    await this.templateRepository.save(template);
  }

  /** Админ: одобрить публикацию */
  async approve(id: string): Promise<FlowTemplate> {
    const template = await this.adminGetById(id);
    if (template.status !== FlowTemplateStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Можно одобрить только темплейт со статусом "pending_review", текущий: "${template.status}"`,
      );
    }
    template.status = FlowTemplateStatus.PUBLISHED;
    template.publishedAt = new Date();
    template.rejectionReason = null;
    const saved = await this.templateRepository.save(template);
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.FLOW_TEMPLATE_APPROVED,
        `Ваш шаблон «${saved.name}» одобрен и опубликован в галерее`,
        { templateId: saved.id, templateName: saved.name },
      );
    }
    return saved;
  }

  /** Админ: отклонить публикацию */
  async reject(id: string, reason: string): Promise<FlowTemplate> {
    const template = await this.adminGetById(id);
    if (template.status !== FlowTemplateStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Можно отклонить только темплейт со статусом "pending_review", текущий: "${template.status}"`,
      );
    }
    template.status = FlowTemplateStatus.REJECTED;
    template.rejectionReason = reason;
    const saved = await this.templateRepository.save(template);
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.FLOW_TEMPLATE_REJECTED,
        `Ваш шаблон «${saved.name}» отклонён. Причина: ${reason}`,
        { templateId: saved.id, templateName: saved.name, reason },
      );
    }
    return saved;
  }

  /** Админ: одобрить удаление */
  async approveDeletion(id: string): Promise<FlowTemplate> {
    const template = await this.adminGetById(id);
    if (template.status !== FlowTemplateStatus.PENDING_DELETION) {
      throw new BadRequestException(
        `Одобрить удаление можно только для статуса "pending_deletion"`,
      );
    }
    template.status = FlowTemplateStatus.ARCHIVED;
    template.archivedAt = new Date();
    const saved = await this.templateRepository.save(template);
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.FLOW_TEMPLATE_DELETION_APPROVED,
        `Ваш запрос на удаление шаблона «${saved.name}» одобрен`,
        { templateId: saved.id, templateName: saved.name },
      );
    }
    return saved;
  }

  /** Админ: отклонить удаление */
  async rejectDeletion(id: string, reason?: string): Promise<FlowTemplate> {
    const template = await this.adminGetById(id);
    if (template.status !== FlowTemplateStatus.PENDING_DELETION) {
      throw new BadRequestException(
        `Отклонить удаление можно только для статуса "pending_deletion"`,
      );
    }
    template.status = FlowTemplateStatus.PUBLISHED;
    template.deletionRequestReason = null;
    const saved = await this.templateRepository.save(template);
    if (saved.authorId) {
      await this.notifyAuthor(
        saved.authorId,
        NotificationType.FLOW_TEMPLATE_DELETION_REJECTED,
        reason
          ? `Запрос на удаление шаблона «${saved.name}» отклонён. ${reason}`
          : `Запрос на удаление шаблона «${saved.name}» отклонён`,
        { templateId: saved.id, templateName: saved.name, reason },
      );
    }
    return saved;
  }

  /** Админ: установить/снять isPlatformChoice */
  async setPlatformChoice(
    id: string,
    isPlatformChoice: boolean,
  ): Promise<FlowTemplate> {
    const template = await this.adminGetById(id);
    template.isPlatformChoice = isPlatformChoice;
    return this.templateRepository.save(template);
  }

  /** Админ: дублировать темплейт */
  async duplicate(id: string): Promise<FlowTemplate> {
    const original = await this.adminGetById(id);

    const duplicate = this.templateRepository.create({
      name: `${original.name} (копия)`,
      description: original.description,
      type: original.type,
      categoryId: original.categoryId,
      tags: [...original.tags],
      flowData: JSON.parse(JSON.stringify(original.flowData)),
      status: FlowTemplateStatus.DRAFT,
      authorId: null,
      nodeCount: original.nodeCount,
    });

    return this.templateRepository.save(duplicate);
  }

  // ===== Приватные хелперы =====

  /** Отправляет уведомление автору темплейта (только если authorId задан). Ошибки не пробрасываем. */
  private async notifyAuthor(
    userId: string,
    type: NotificationType,
    message: string,
    payload: { templateId: string; templateName: string; reason?: string },
  ): Promise<void> {
    try {
      await this.notificationService.sendToUser(userId, type, {
        message,
        ...payload,
      });
    } catch (err) {
      // Логируем, но не прерываем основной поток
      if (err?.message) {
        console.warn(
          `[FlowTemplatesService] Не удалось отправить уведомление автору ${userId}:`,
          err.message,
        );
      }
    }
  }

  private async findOwnTemplate(
    userId: string,
    id: string,
  ): Promise<FlowTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, authorId: userId },
      relations: ["category"],
    });
    if (!template) {
      throw new NotFoundException("Темплейт не найден или вам не принадлежит");
    }
    return template;
  }

  private applyGalleryFilters(
    qb: SelectQueryBuilder<FlowTemplate>,
    query: GalleryQueryDto,
  ): void {
    if (query.search) {
      qb.andWhere(
        "(t.name ILIKE :search OR t.description ILIKE :search OR :searchTag = ANY(t.tags))",
        {
          search: `%${query.search}%`,
          searchTag: query.search.toLowerCase(),
        },
      );
    }
    if (query.type) {
      qb.andWhere("t.type = :type", { type: query.type });
    }
    if (query.categoryId) {
      qb.andWhere("t.categoryId = :categoryId", {
        categoryId: query.categoryId,
      });
    }
    if (query.tags && query.tags.length > 0) {
      qb.andWhere("t.tags && :tags", { tags: query.tags });
    }
    if (query.isPlatformChoice !== undefined) {
      qb.andWhere("t.isPlatformChoice = :isPlatformChoice", {
        isPlatformChoice: query.isPlatformChoice,
      });
    }
  }

  private applyGallerySorting(
    qb: SelectQueryBuilder<FlowTemplate>,
    sortBy?: string,
  ): void {
    // Всегда platformChoice вверху
    qb.addOrderBy("t.isPlatformChoice", "DESC");

    switch (sortBy) {
      case "popular":
        qb.addOrderBy("t.usageCount", "DESC");
        break;
      case "name":
        qb.addOrderBy("t.name", "ASC");
        break;
      case "newest":
      default:
        qb.addOrderBy("t.publishedAt", "DESC", "NULLS LAST");
        break;
    }
  }

  private toGalleryListItem(template: FlowTemplate) {
    const author = template.author;
    const authorName = author
      ? `${author.firstName || ""} ${author.lastName || ""}`.trim() ||
        author.telegramUsername ||
        null
      : null;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category
        ? {
            id: template.category.id,
            slug: template.category.slug,
            name: template.category.name,
          }
        : null,
      tags: template.tags,
      isPlatformChoice: template.isPlatformChoice,
      usageCount: template.usageCount,
      nodeCount: template.nodeCount,
      authorName,
      publishedAt: template.publishedAt,
    };
  }
}
