import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import * as crypto from "crypto";
import { Message, MessageType } from "../../database/entities/message.entity";
import { Bot } from "../../database/entities/bot.entity";
import { BroadcastDto } from "./dto/broadcast.dto";
import { TelegramService } from "../telegram/telegram.service";

interface MessageFilters {
  page: number;
  limit: number;
  type?: "incoming" | "outgoing";
  search?: string;
}

interface DialogFilters {
  page: number;
  limit: number;
  search?: string;
  sortBy: "lastActivity" | "messageCount" | "createdAt";
  sortOrder: "asc" | "desc";
  chatType?: "private" | "group" | "supergroup" | "channel";
}

interface UserFilters {
  page: number;
  limit: number;
  search?: string;
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
  chatInfo?: {
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
    username?: string;
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

export interface BotUser {
  chatId: string;
  userInfo: {
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isBot?: boolean;
  };
  lastActivityAt: string;
  messageCount: number;
}

export interface BotUsersResponse {
  users: BotUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    private telegramService: TelegramService
  ) {}

  async getBotMessages(botId: string, userId: string, filters: MessageFilters) {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const { page, limit, type, search } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.messageRepository
      .createQueryBuilder("message")
      .where("message.botId = :botId", { botId })
      .orderBy("message.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    if (type) {
      queryBuilder.andWhere("message.type = :type", {
        type: type === "incoming" ? MessageType.INCOMING : MessageType.OUTGOING,
      });
    }

    if (search && search.trim()) {
      queryBuilder.andWhere("message.text ILIKE :search", {
        search: `%${search.trim()}%`,
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

    // Отладочная информация
    console.log(`Dialog for botId: ${botId}, chatId: ${chatId}`);
    console.log(`Total messages found: ${total}`);
    console.log(`Messages on page ${page}: ${messages.length}`);

    if (messages.length > 0) {
      const messageTypes = messages.reduce(
        (acc, msg) => {
          acc[msg.type] = (acc[msg.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      console.log("Message types in dialog:", messageTypes);

      // Показываем примеры сообщений
      console.log(
        "Sample messages:",
        messages.slice(0, 5).map((msg) => ({
          id: msg.id,
          type: msg.type,
          chatId: msg.telegramChatId,
          text: msg.text?.substring(0, 50) + "...",
          createdAt: msg.createdAt,
        }))
      );
    }

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

    const { page, limit, search, sortBy, sortOrder, chatType } = filters;
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
        "MIN(message.createdAt) as createdAt",
        "COUNT(message.id) as messageCount",
        "MAX(message.createdAt) as lastActivityAt",
        "SUM(CASE WHEN message.isProcessed = false THEN 1 ELSE 0 END) as unreadCount",
      ])
      .where("message.botId = :botId", { botId })
      .groupBy("message.telegramChatId");

    // Фильтр по типу чата
    if (chatType) {
      queryBuilder.andWhere("message.metadata->>'chatType' = :chatType", {
        chatType,
      });
    }

    // Добавляем поиск по имени пользователя или названию группы
    if (search) {
      queryBuilder.andWhere(
        "(message.metadata->>'firstName' ILIKE :search OR message.metadata->>'lastName' ILIKE :search OR message.metadata->>'username' ILIKE :search OR message.metadata->>'chatTitle' ILIKE :search)",
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

    if (rawDialogs.length === 0) {
      return {
        dialogs: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Получаем все необходимые сообщения одним запросом
    const chatIds = rawDialogs.map((dialog) => dialog.chatid);

    // Получаем последние и первые сообщения для каждого диалога
    const messagesQuery = this.messageRepository
      .createQueryBuilder("message")
      .where("message.botId = :botId", { botId })
      .andWhere("message.telegramChatId IN (:...chatIds)", { chatIds })
      .orderBy("message.telegramChatId")
      .addOrderBy("message.createdAt", "ASC")
      .getMany();

    const allMessages = await messagesQuery;

    console.log("All messages found:", allMessages.length);
    console.log("Chat IDs:", chatIds);

    // Группируем сообщения по chatId
    const messagesByChat = new Map<string, Message[]>();
    allMessages.forEach((message) => {
      if (!messagesByChat.has(message.telegramChatId)) {
        messagesByChat.set(message.telegramChatId, []);
      }
      messagesByChat.get(message.telegramChatId)!.push(message);
    });

    console.log("Messages by chat:", Array.from(messagesByChat.keys()));

    // Получаем первые и последние сообщения
    const lastMessages: Message[] = [];
    const firstMessages: Message[] = [];

    messagesByChat.forEach((messages) => {
      if (messages.length > 0) {
        firstMessages.push(messages[0]); // Первое сообщение
        lastMessages.push(messages[messages.length - 1]); // Последнее сообщение
      }
    });

    // Создаем мапы для быстрого поиска
    const lastMessageMap = new Map(
      lastMessages.map((msg) => [msg.telegramChatId, msg])
    );
    const firstMessageMap = new Map(
      firstMessages.map((msg) => [msg.telegramChatId, msg])
    );

    // Формируем результат
    const dialogs: Dialog[] = rawDialogs
      .map((rawDialog) => {
        const lastMessage = lastMessageMap.get(rawDialog.chatid);
        const firstMessage = firstMessageMap.get(rawDialog.chatid);

        // Если не найдены сообщения в мапах, попробуем найти их в исходных данных
        if (!lastMessage || !firstMessage) {
          const chatMessages = messagesByChat.get(rawDialog.chatid);
          if (chatMessages && chatMessages.length > 0) {
            const lastMsg = chatMessages[chatMessages.length - 1];
            const firstMsg = chatMessages[0];

            return {
              chatId: rawDialog.chatid,
              userInfo: firstMsg.metadata || {},
              lastMessage: lastMsg,
              messageCount: parseInt(rawDialog.messagecount),
              unreadCount: parseInt(rawDialog.unreadcount) || 0,
              lastActivityAt: rawDialog.lastactivityat,
              createdAt: rawDialog.createdat,
            };
          }
          return null;
        }

        return {
          chatId: rawDialog.chatid,
          userInfo: firstMessage.metadata || {},
          chatInfo: {
            type:
              (firstMessage.metadata?.chatType as
                | "private"
                | "group"
                | "supergroup"
                | "channel") || "private",
            title: firstMessage.metadata?.chatTitle,
            username: firstMessage.metadata?.chatUsername,
          },
          lastMessage,
          messageCount: parseInt(rawDialog.messagecount),
          unreadCount: parseInt(rawDialog.unreadcount) || 0,
          lastActivityAt: rawDialog.lastactivityat,
          createdAt: rawDialog.createdat,
        };
      })
      .filter((dialog) => dialog !== null) as Dialog[];

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

  async getBotGroups(botId: string, userId: string, filters: DialogFilters) {
    // Используем getBotDialogs с фильтром только групповых чатов
    return this.getBotDialogs(botId, userId, {
      ...filters,
      chatType: "group", // Фильтруем только группы
    });
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

  async deleteDialog(
    botId: string,
    chatId: string,
    userId: string
  ): Promise<{ success: boolean; deletedCount: number }> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Подсчитываем количество сообщений для логирования
    const messageCount = await this.messageRepository.count({
      where: {
        botId,
        telegramChatId: chatId,
      },
    });

    // Удаляем все сообщения диалога
    const deleteResult = await this.messageRepository.delete({
      botId,
      telegramChatId: chatId,
    });

    console.log(
      `Удален диалог: botId=${botId}, chatId=${chatId}, сообщений=${messageCount}`
    );

    return {
      success: true,
      deletedCount: messageCount,
    };
  }

  async getBotUsers(
    botId: string,
    userId: string,
    filters: UserFilters
  ): Promise<BotUsersResponse> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const { page, limit, search } = filters;
    const skip = (page - 1) * limit;

    // Создаем запрос для получения уникальных пользователей
    let queryBuilder = this.messageRepository
      .createQueryBuilder("message")
      .select([
        "message.telegramChatId as chatId",
        "COALESCE(message.metadata->>'firstName', '') as firstName",
        "COALESCE(message.metadata->>'lastName', '') as lastName",
        "COALESCE(message.metadata->>'username', '') as username",
        "COALESCE(message.metadata->>'languageCode', '') as languageCode",
        "COALESCE(message.metadata->>'isBot', 'false') as isBot",
        "MAX(message.createdAt) as lastActivityAt",
        "COUNT(*) as messageCount",
      ])
      .where("message.botId = :botId", { botId })
      .andWhere("message.type = :type", { type: MessageType.INCOMING })
      .andWhere("message.telegramChatId IS NOT NULL")
      .andWhere("message.telegramChatId != ''")
      .groupBy("message.telegramChatId")
      .orderBy("lastActivityAt", "DESC")
      .offset(skip)
      .limit(limit);

    // Добавляем поиск если указан
    if (search && search.trim()) {
      queryBuilder.andWhere(
        "(message.metadata->>'firstName' ILIKE :search OR " +
          "message.metadata->>'lastName' ILIKE :search OR " +
          "message.metadata->>'username' ILIKE :search)",
        { search: `%${search.trim()}%` }
      );
    }

    const [rawUsers, total] = await Promise.all([
      queryBuilder.getRawMany(),
      this.messageRepository
        .createQueryBuilder("message")
        .select("COUNT(DISTINCT message.telegramChatId)", "count")
        .where("message.botId = :botId", { botId })
        .andWhere("message.type = :type", { type: MessageType.INCOMING })
        .andWhere("message.telegramChatId IS NOT NULL")
        .andWhere("message.telegramChatId != ''")
        .getRawOne()
        .then((result) => parseInt(result.count) || 0),
    ]);

    // Преобразуем результат в нужный формат
    const users: BotUser[] = rawUsers
      .filter((raw) => {
        const isValid = raw.chatId && raw.chatId.trim() !== "";
        return isValid;
      })
      .map((raw) => ({
        chatId: raw.chatId,
        userInfo: {
          firstName:
            raw.firstName && raw.firstName.trim() !== ""
              ? raw.firstName
              : undefined,
          lastName:
            raw.lastName && raw.lastName.trim() !== ""
              ? raw.lastName
              : undefined,
          username:
            raw.username && raw.username.trim() !== ""
              ? raw.username
              : undefined,
          languageCode:
            raw.languageCode && raw.languageCode.trim() !== ""
              ? raw.languageCode
              : undefined,
          isBot: raw.isBot === "true",
        },
        lastActivityAt: raw.lastActivityAt,
        messageCount: parseInt(raw.messageCount) || 0,
      }));

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private createInlineKeyboard(buttons: any[]): any {
    if (!buttons || buttons.length === 0) {
      return undefined;
    }

    return {
      inline_keyboard: buttons.map((button) => {
        const btnData: any = { text: button.text };

        if (button.webApp) {
          btnData.web_app = { url: button.webApp };
        } else if (button.url) {
          btnData.url = button.url;
        } else if (button.callbackData) {
          btnData.callback_data = button.callbackData;
        }

        return [btnData];
      }),
    };
  }

  async sendBroadcast(botId: string, userId: string, data: BroadcastDto) {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    if (!bot.token) {
      throw new BadRequestException("Токен бота не настроен");
    }

    // Проверяем валидность токена
    const decryptedToken = this.decryptToken(bot.token);
    const botInfo = await this.telegramService.getBotInfo(decryptedToken);
    if (!botInfo) {
      throw new BadRequestException("Неверный токен бота или бот недоступен");
    }

    console.log(`Информация о боте:`, {
      id: botInfo.id,
      username: botInfo.username,
      first_name: botInfo.first_name,
    });

    // Получаем список получателей используя данные из диалогов
    let recipientChatIds: string[] = [];

    switch (data.recipients.type) {
      case "all":
        // Получаем всех пользователей бота
        const allUsersQuery = this.messageRepository
          .createQueryBuilder("message")
          .select("DISTINCT message.telegramChatId", "chatId")
          .where("message.botId = :botId", { botId })
          .andWhere("message.telegramChatId IS NOT NULL")
          .andWhere("message.telegramChatId != ''");

        // Если указан конкретный тип чата - фильтруем по нему
        if (data.recipients.chatType) {
          allUsersQuery.andWhere("message.metadata->>'chatType' = :chatType", {
            chatType: data.recipients.chatType,
          });
        }
        // Если тип чата не указан - берем ВСЕ чаты (приватные + группы)

        const allUsersData = await allUsersQuery.getRawMany();
        recipientChatIds = allUsersData.map((user) => user.chatId);
        console.log(
          `Тип получателей: all, тип чата: ${data.recipients.chatType || "все"}, найдено: ${recipientChatIds.length}`
        );
        break;

      case "specific":
        recipientChatIds = (data.recipients.specificUsers || []).filter(
          (chatId) => chatId && chatId.trim() !== ""
        );
        break;

      case "groups":
        // Получаем все групповые чаты бота
        const allGroupsQuery = this.messageRepository
          .createQueryBuilder("message")
          .select("DISTINCT message.telegramChatId", "chatId")
          .addSelect("message.metadata->>'chatType'", "chatType")
          .addSelect("message.metadata->>'title'", "title")
          .where("message.botId = :botId", { botId })
          .andWhere("message.telegramChatId IS NOT NULL")
          .andWhere("message.telegramChatId != ''");

        // Если указан конкретный тип чата - фильтруем по нему
        if (data.recipients.chatType) {
          allGroupsQuery.andWhere("message.metadata->>'chatType' = :chatType", {
            chatType: data.recipients.chatType,
          });
        } else {
          // Если не указан - берем все типы групп
          allGroupsQuery.andWhere(
            "message.metadata->>'chatType' IN ('group', 'supergroup', 'channel')"
          );
        }

        const allGroups = await allGroupsQuery.getRawMany();
        console.log(
          `Тип получателей: groups, тип чата: ${data.recipients.chatType || "все группы"}, найдено: ${allGroups.length}`
        );
        recipientChatIds = allGroups.map((group) => group.chatId);
        break;

      case "specific_groups":
        recipientChatIds = (data.recipients.specificGroups || []).filter(
          (chatId) => chatId && chatId.trim() !== ""
        );
        console.log(`Конкретные группы для рассылки:`, recipientChatIds);
        break;

      case "activity":
        // Получаем пользователей с фильтрацией по активности
        const activityQuery = this.messageRepository
          .createQueryBuilder("message")
          .select("message.telegramChatId", "chatId")
          .addSelect("MAX(message.createdAt)", "lastActivity")
          .where("message.botId = :botId", { botId })
          .andWhere("message.telegramChatId IS NOT NULL")
          .andWhere("message.telegramChatId != ''")
          .groupBy("message.telegramChatId");

        // Фильтр по типу чата если указан
        if (data.recipients.chatType) {
          activityQuery.andWhere("message.metadata->>'chatType' = :chatType", {
            chatType: data.recipients.chatType,
          });
        }

        // Фильтр по дате активности
        if (data.recipients.activityDate) {
          const filterDate = new Date(data.recipients.activityDate);
          if (data.recipients.activityType === "after") {
            activityQuery.having("MAX(message.createdAt) >= :filterDate", {
              filterDate,
            });
          } else {
            activityQuery.having("MAX(message.createdAt) <= :filterDate", {
              filterDate,
            });
          }
        }

        const activityUsers = await activityQuery.getRawMany();
        recipientChatIds = activityUsers.map((user) => user.chatId);
        console.log(
          `Тип получателей: activity, тип чата: ${data.recipients.chatType || "все"}, найдено: ${recipientChatIds.length}`
        );
        break;
    }

    console.log(`Рассылка: найдено ${recipientChatIds.length} получателей`);
    console.log(
      `Токен бота: ${decryptedToken ? decryptedToken.substring(0, 10) + "..." : "НЕ НАЙДЕН"}`
    );

    // Отправляем сообщения через Telegram API
    let sentCount = 0;
    let failedCount = 0;
    const failedChatIds: string[] = [];

    for (const chatId of recipientChatIds) {
      try {
        let success = false;
        const replyMarkup = this.createInlineKeyboard(data.buttons);

        // Если есть изображение - отправляем фото с caption
        if (data.image) {
          console.log(`Отправляем фото пользователю ${chatId}`);

          // Подготавливаем файл для отправки
          let photoData: string | Buffer;
          if (Buffer.isBuffer(data.image)) {
            // Если это уже Buffer
            photoData = data.image;
          } else if (data.image.buffer) {
            // Если это Express.Multer.File - используем buffer
            photoData = data.image.buffer;
          } else if (data.image.path) {
            // Если есть путь к файлу (локальный файл)
            photoData = data.image.path;
          } else if (typeof data.image === "string") {
            // Если это строка (URL или file_id)
            photoData = data.image;
          } else {
            console.error(`Неподдерживаемый тип изображения для ${chatId}`);
            failedCount++;
            failedChatIds.push(chatId);
            continue;
          }

          const result = await this.telegramService.sendPhoto(
            decryptedToken,
            chatId,
            photoData,
            {
              caption: data.text || undefined,
              parse_mode: data.text ? "HTML" : undefined,
              reply_markup: replyMarkup,
            }
          );

          console.log(
            `Результат отправки фото:`,
            result ? "успешно" : "ошибка"
          );

          if (result) {
            success = true;
            console.log(`Фото отправлено пользователю ${chatId}`);
          } else {
            console.log(`Не удалось отправить фото пользователю ${chatId}`);
          }
        }
        // Если нет изображения, но есть текст - отправляем текстовое сообщение
        else if (data.text) {
          console.log(
            `Отправляем текст пользователю ${chatId}:`,
            data.text.substring(0, 50) + "..."
          );

          console.log(`Reply markup:`, replyMarkup);

          const result = await this.telegramService.sendMessage(
            decryptedToken,
            chatId,
            data.text,
            {
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }
          );

          console.log(
            `Результат отправки сообщения:`,
            result ? "успешно" : "ошибка"
          );

          if (result) {
            success = true;
            console.log(`Сообщение отправлено пользователю ${chatId}`);
          } else {
            console.log(
              `Не удалось отправить сообщение пользователю ${chatId}`
            );
          }
        }

        if (success) {
          sentCount++;
        } else {
          failedCount++;
          failedChatIds.push(chatId);
        }

        // Небольшая задержка между отправками для избежания rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `Ошибка отправки сообщения пользователю ${chatId}:`,
          error.message
        );
        failedCount++;
        failedChatIds.push(chatId);
      }
    }

    console.log(
      `Рассылка завершена: отправлено ${sentCount}, не удалось ${failedCount}`
    );

    return {
      success: true,
      sentCount,
      failedCount,
      totalRecipients: recipientChatIds.length,
      failedChatIds: failedChatIds.length > 0 ? failedChatIds : undefined,
    };
  }

  // Расшифровка токена (копия из BotsService)
  private decryptToken(encryptedToken: string): string {
    const algorithm = "aes-256-cbc";
    const keyString =
      process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
    // Убеждаемся, что ключ имеет правильную длину (32 байта для AES-256)
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
