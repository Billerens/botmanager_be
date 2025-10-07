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

export interface MessageStats {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  uniqueUsers: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
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
}
