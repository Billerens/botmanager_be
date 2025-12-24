import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowContext } from "./base-node-handler.interface";
import { Message } from "../../../database/entities/message.entity";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";

@Injectable()
export class BroadcastNodeHandler extends BaseNodeHandler {
  constructor(
    @InjectRepository(BotFlow)
    protected readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    protected readonly botFlowNodeRepository: Repository<BotFlowNode>,
    protected readonly telegramService: TelegramService,
    protected readonly botsService: BotsService,
    protected readonly logger: CustomLoggerService,
    protected readonly messagesService: MessagesService,
    protected readonly activityLogService: ActivityLogService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>
  ) {
    super(
      botFlowRepository,
      botFlowNodeRepository,
      telegramService,
      botsService,
      logger,
      messagesService,
      activityLogService
    );
  }

  canHandle(nodeType: string): boolean {
    return nodeType === "broadcast";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot } = context;
    if (!currentNode?.data?.broadcast) {
      this.logger.warn("Данные broadcast не найдены");
      return;
    }

    const broadcast = currentNode.data.broadcast as any;
    const startTime = new Date();

    // Подставляем переменные в текст
    const processedText = this.substituteVariables(broadcast.text, context);

    // Получаем список получателей
    let recipientChatIds: string[] = [];

    try {
      switch (broadcast.recipientType) {
        case "all":
          // Получаем всех пользователей бота
          const allUsersQuery = this.messageRepository
            .createQueryBuilder("message")
            .select("DISTINCT message.telegramChatId", "chatId")
            .where("message.botId = :botId", { botId: bot.id })
            .andWhere("message.telegramChatId IS NOT NULL")
            .andWhere("message.telegramChatId != ''")
            .andWhere("message.telegramChatId NOT LIKE :systemPattern", {
              systemPattern: "system_%",
            });

          // Если указан конкретный тип чата - фильтруем по нему
          if (broadcast.chatType) {
            allUsersQuery.andWhere(
              "message.metadata->>'chatType' = :chatType",
              {
                chatType: broadcast.chatType,
              }
            );
          }
          // Если тип чата не указан - берем ВСЕ чаты (приватные + группы)

          const allUsers = await allUsersQuery.getRawMany();
          recipientChatIds = allUsers.map((user) => user.chatId);
          break;

        case "specific":
          recipientChatIds = (broadcast.specificUsers || []).filter(
            (chatId) =>
              chatId && chatId.trim() !== "" && !chatId.startsWith("system_")
          );
          break;

        case "groups":
          // Получаем все групповые чаты бота
          const allGroupsQuery = this.messageRepository
            .createQueryBuilder("message")
            .select("DISTINCT message.telegramChatId", "chatId")
            .addSelect("message.metadata->>'chatType'", "chatType")
            .addSelect("message.metadata->>'title'", "title")
            .where("message.botId = :botId", { botId: bot.id })
            .andWhere("message.telegramChatId IS NOT NULL")
            .andWhere("message.telegramChatId != ''")
            .andWhere("message.telegramChatId NOT LIKE :systemPattern", {
              systemPattern: "system_%",
            });

          // Если указан конкретный тип чата - фильтруем по нему
          if (broadcast.chatType) {
            allGroupsQuery.andWhere(
              "message.metadata->>'chatType' = :chatType",
              {
                chatType: broadcast.chatType,
              }
            );
          } else {
            // Если не указан - берем все типы групп
            allGroupsQuery.andWhere(
              "message.metadata->>'chatType' IN ('group', 'supergroup', 'channel')"
            );
          }

          const allGroups = await allGroupsQuery.getRawMany();
          recipientChatIds = allGroups.map((group) => group.chatId);
          break;

        case "specific_groups":
          recipientChatIds = (broadcast.specificGroups || []).filter(
            (chatId) =>
              chatId && chatId.trim() !== "" && !chatId.startsWith("system_")
          );
          break;

        case "activity":
          // Получаем пользователей с фильтрацией по активности
          const activityQuery = this.messageRepository
            .createQueryBuilder("message")
            .select("message.telegramChatId", "chatId")
            .addSelect("MAX(message.createdAt)", "lastActivity")
            .where("message.botId = :botId", { botId: bot.id })
            .andWhere("message.telegramChatId IS NOT NULL")
            .andWhere("message.telegramChatId != ''")
            .andWhere("message.telegramChatId NOT LIKE :systemPattern", {
              systemPattern: "system_%",
            })
            .groupBy("message.telegramChatId");

          // Фильтр по типу чата если указан
          if (broadcast.chatType) {
            activityQuery.andWhere(
              "message.metadata->>'chatType' = :chatType",
              {
                chatType: broadcast.chatType,
              }
            );
          }

          if (broadcast.activityDate) {
            const filterDate = new Date(broadcast.activityDate);
            if (broadcast.activityType === "after") {
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
          break;
      }

      // Отправляем сообщения
      let sentCount = 0;
      let failedCount = 0;

      // Подготавливаем клавиатуру если есть кнопки
      let replyMarkup = undefined;
      if (broadcast.buttons && broadcast.buttons.length > 0) {
        replyMarkup = {
          inline_keyboard: broadcast.buttons.map((button) => {
            // Подставляем переменные в текст кнопок
            const processedText = this.substituteVariables(
              button.text,
              context
            );
            const buttonData: any = { text: processedText };

            // Определяем тип кнопки и подставляем переменные
            if (button.webApp) {
              buttonData.web_app = {
                url: this.substituteVariables(button.webApp, context),
              };
            } else if (button.url) {
              buttonData.url = this.substituteVariables(button.url, context);
            } else if (button.callbackData) {
              buttonData.callback_data = this.substituteVariables(
                button.callbackData,
                context
              );
            }

            return [buttonData];
          }),
        };
      }

      for (const chatId of recipientChatIds) {
        try {
          const decryptedToken = this.botsService.decryptToken(bot.token);
          let result = null;

          // Если есть изображение - отправляем фото с caption
          if (broadcast.image) {
            // Для изображений с caption не используем sendLongMessage - Telegram ограничивает caption 1024 символами
            result = await this.telegramService.sendPhoto(
              decryptedToken,
              chatId,
              broadcast.image, // URL изображения
              {
                caption: processedText || undefined,
                parse_mode: processedText ? "HTML" : undefined,
                reply_markup: replyMarkup,
              }
            );
          }
          // Если нет изображения, но есть текст - отправляем текстовое сообщение
          else if (processedText) {
            // sendMessage автоматически использует sendLongMessage при необходимости
            // и отключает parse_mode для длинных сообщений
            result = await this.telegramService.sendMessage(
              decryptedToken,
              chatId,
              processedText,
              {
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              }
            );
          }

          if (result) {
            sentCount++;
          } else {
            failedCount++;
          }

          // Добавляем небольшую задержку между отправками (защита от rate limit)
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          failedCount++;
        }
      }

      const completedTime = new Date();

      // Сохраняем статистику в переменные
      session.variables[`broadcast_${currentNode.nodeId}_text`] =
        broadcast.text;
      session.variables[`broadcast_${currentNode.nodeId}_sent_count`] =
        String(sentCount);
      session.variables[`broadcast_${currentNode.nodeId}_failed_count`] =
        String(failedCount);
      session.variables[`broadcast_${currentNode.nodeId}_total_recipients`] =
        String(recipientChatIds.length);
      session.variables[`broadcast_${currentNode.nodeId}_status`] =
        failedCount === 0 ? "success" : sentCount > 0 ? "partial" : "failed";
      session.variables[`broadcast_${currentNode.nodeId}_started_at`] =
        startTime.toISOString();
      session.variables[`broadcast_${currentNode.nodeId}_completed_at`] =
        completedTime.toISOString();
      session.variables[`broadcast_${currentNode.nodeId}_recipient_type`] =
        broadcast.recipientType || "all";
    } catch (error) {
      session.variables[`broadcast_${currentNode.nodeId}_status`] = "failed";
      session.variables[`broadcast_${currentNode.nodeId}_error`] =
        error.message;
    }

    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
