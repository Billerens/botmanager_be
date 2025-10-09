import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { Message, MessageType } from "../../database/entities/message.entity";
import { Bot } from "../../database/entities/bot.entity";

interface MessageFilters {
  page: number;
  limit: number;
  type?: "incoming" | "outgoing";
}

interface DialogFilters {
  page: number;
  limit: number;
  search?: string;
  sortBy: "lastActivity" | "messageCount" | "createdAt";
  sortOrder: "asc" | "desc";
}

export interface MessageStats {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  uniqueUsers: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
}

export interface Dialog {
  chatId: string;
  userInfo: {
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isBot?: boolean;
  };
  lastMessage: Message;
  messageCount: number;
  unreadCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface DialogStats {
  totalDialogs: number;
  activeDialogs: number;
  totalMessages: number;
  averageMessagesPerDialog: number;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>
  ) {}

  async getBotMessages(botId: string, userId: string, filters: MessageFilters) {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const { page, limit, type } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.messageRepository
      .createQueryBuilder("message")
      .where("message.botId = :botId", { botId })
      .orderBy("message.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    if (type) {
      queryBuilder.andWhere("message.type = :type", {
        type: type.toUpperCase(),
      });
    }

    const [messages, total] = await queryBuilder.getManyAndCount();

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDialog(
    botId: string,
    chatId: string,
    userId: string,
    filters: { page: number; limit: number }
  ) {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: {
        botId,
        telegramChatId: chatId,
      },
      order: { createdAt: "ASC" },
      skip,
      take: limit,
    });

    // Получаем информацию о пользователе из первого сообщения
    const userInfo = messages.length > 0 ? messages[0].metadata : null;

    return {
      messages,
      userInfo,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBotMessageStats(
    botId: string,
    userId: string
  ): Promise<MessageStats> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalMessages,
      incomingMessages,
      outgoingMessages,
      uniqueUsers,
      messagesToday,
      messagesThisWeek,
      messagesThisMonth,
    ] = await Promise.all([
      this.messageRepository.count({ where: { botId } }),
      this.messageRepository.count({
        where: { botId, type: MessageType.INCOMING },
      }),
      this.messageRepository.count({
        where: { botId, type: MessageType.OUTGOING },
      }),
      this.messageRepository
        .createQueryBuilder("message")
        .select("COUNT(DISTINCT message.telegramChatId)", "count")
        .where("message.botId = :botId", { botId })
        .getRawOne()
        .then((result) => parseInt(result.count)),
      this.messageRepository.count({
        where: {
          botId,
          createdAt: Between(today, now),
        },
      }),
      this.messageRepository.count({
        where: {
          botId,
          createdAt: Between(weekAgo, now),
        },
      }),
      this.messageRepository.count({
        where: {
          botId,
          createdAt: Between(monthAgo, now),
        },
      }),
    ]);

    return {
      totalMessages,
      incomingMessages,
      outgoingMessages,
      uniqueUsers,
      messagesToday,
      messagesThisWeek,
      messagesThisMonth,
    };
  }

  async createMessage(messageData: Partial<Message>): Promise<Message> {
    const message = this.messageRepository.create(messageData);
    return this.messageRepository.save(message);
  }

  async markAsProcessed(messageId: string): Promise<void> {
    await this.messageRepository.update(messageId, {
      isProcessed: true,
      processedAt: new Date(),
    });
  }

  async markAsError(messageId: string, errorMessage: string): Promise<void> {
    await this.messageRepository.update(messageId, {
      isProcessed: true,
      processedAt: new Date(),
      errorMessage,
    });
  }

  async create(messageData: Partial<Message>): Promise<Message> {
    const message = this.messageRepository.create(messageData);
    return this.messageRepository.save(message);
  }

  async getBotDialogs(botId: string, userId: string, filters: DialogFilters) {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const { page, limit, search, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    // Создаем подзапрос для получения последнего сообщения каждого диалога
    const lastMessageSubQuery = this.messageRepository
      .createQueryBuilder("m2")
      .select("m2.telegramChatId")
      .addSelect("MAX(m2.createdAt)", "lastActivity")
      .where("m2.botId = :botId", { botId })
      .groupBy("m2.telegramChatId");

    // Основной запрос для получения диалогов
    let queryBuilder = this.messageRepository
      .createQueryBuilder("message")
      .select([
        "message.telegramChatId as chatId",
        "message.metadata as userInfo",
        "message.createdAt as createdAt",
        "COUNT(message.id) as messageCount",
        "MAX(message.createdAt) as lastActivityAt",
        "SUM(CASE WHEN message.isProcessed = false THEN 1 ELSE 0 END) as unreadCount",
      ])
      .where("message.botId = :botId", { botId })
      .groupBy("message.telegramChatId, message.metadata, message.createdAt");

    // Добавляем поиск по имени пользователя
    if (search) {
      queryBuilder.andWhere(
        "(message.metadata->>'firstName' ILIKE :search OR message.metadata->>'lastName' ILIKE :search OR message.metadata->>'username' ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    // Добавляем сортировку
    const orderDirection = sortOrder.toUpperCase() as "ASC" | "DESC";
    switch (sortBy) {
      case "lastActivity":
        queryBuilder.orderBy("lastActivityAt", orderDirection);
        break;
      case "messageCount":
        queryBuilder.orderBy("messageCount", orderDirection);
        break;
      case "createdAt":
        queryBuilder.orderBy("createdAt", orderDirection);
        break;
    }

    // Добавляем пагинацию
    queryBuilder.skip(skip).take(limit);

    const rawDialogs = await queryBuilder.getRawMany();

    // Получаем последние сообщения для каждого диалога
    const dialogs: Dialog[] = [];
    for (const rawDialog of rawDialogs) {
      const lastMessage = await this.messageRepository.findOne({
        where: {
          botId,
          telegramChatId: rawDialog.chatId,
        },
        order: { createdAt: "DESC" },
      });

      if (lastMessage) {
        dialogs.push({
          chatId: rawDialog.chatId,
          userInfo: rawDialog.userInfo || {},
          lastMessage,
          messageCount: parseInt(rawDialog.messageCount),
          unreadCount: parseInt(rawDialog.unreadCount) || 0,
          lastActivityAt: rawDialog.lastActivityAt,
          createdAt: rawDialog.createdAt,
        });
      }
    }

    // Получаем общее количество диалогов для пагинации
    const totalDialogsQuery = this.messageRepository
      .createQueryBuilder("message")
      .select("COUNT(DISTINCT message.telegramChatId)", "count")
      .where("message.botId = :botId", { botId });

    if (search) {
      totalDialogsQuery.andWhere(
        "(message.metadata->>'firstName' ILIKE :search OR message.metadata->>'lastName' ILIKE :search OR message.metadata->>'username' ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    const totalResult = await totalDialogsQuery.getRawOne();
    const total = parseInt(totalResult.count);

    return {
      dialogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBotDialogStats(botId: string, userId: string): Promise<DialogStats> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalDialogs, activeDialogs, totalMessages] = await Promise.all([
      // Общее количество диалогов
      this.messageRepository
        .createQueryBuilder("message")
        .select("COUNT(DISTINCT message.telegramChatId)", "count")
        .where("message.botId = :botId", { botId })
        .getRawOne()
        .then((result) => parseInt(result.count)),

      // Активные диалоги (с сообщениями за последнюю неделю)
      this.messageRepository
        .createQueryBuilder("message")
        .select("COUNT(DISTINCT message.telegramChatId)", "count")
        .where("message.botId = :botId", { botId })
        .andWhere("message.createdAt >= :weekAgo", { weekAgo })
        .getRawOne()
        .then((result) => parseInt(result.count)),

      // Общее количество сообщений
      this.messageRepository.count({ where: { botId } }),
    ]);

    const averageMessagesPerDialog =
      totalDialogs > 0 ? totalMessages / totalDialogs : 0;

    return {
      totalDialogs,
      activeDialogs,
      totalMessages,
      averageMessagesPerDialog:
        Math.round(averageMessagesPerDialog * 100) / 100,
    };
  }
}
