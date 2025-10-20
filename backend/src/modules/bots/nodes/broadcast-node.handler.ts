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
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>
  ) {
    super(
      botFlowRepository,
      botFlowNodeRepository,
      telegramService,
      botsService,
      logger,
      messagesService
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

    const broadcast = currentNode.data.broadcast;
    const startTime = new Date();

    this.logger.log(
      `Начинаем выполнение рассылки для ноды ${currentNode.nodeId}`
    );

    // Подставляем переменные в текст
    const processedText = this.substituteVariables(broadcast.text, context);

    this.logger.log(`Текст после подстановки переменных: ${processedText}`);

    // Получаем список получателей
    let recipientChatIds: string[] = [];

    try {
      switch (broadcast.recipientType) {
        case "all":
          // Получаем всех уникальных пользователей бота
          const allUsers = await this.messageRepository
            .createQueryBuilder("message")
            .select("DISTINCT message.telegramChatId", "chatId")
            .where("message.botId = :botId", { botId: bot.id })
            .andWhere("message.telegramChatId IS NOT NULL")
            .andWhere("message.telegramChatId != ''")
            .andWhere("message.telegramChatId NOT LIKE :systemPattern", {
              systemPattern: "system_%",
            })
            .getRawMany();

          recipientChatIds = allUsers.map((user) => user.chatId);
          break;

        case "specific":
          recipientChatIds = (broadcast.specificUsers || []).filter(
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

      this.logger.log(
        `Найдено ${recipientChatIds.length} получателей для рассылки`
      );

      // Отправляем сообщения
      let sentCount = 0;
      let failedCount = 0;

      // Подготавливаем клавиатуру если есть кнопки
      let replyMarkup = undefined;
      if (broadcast.buttons && broadcast.buttons.length > 0) {
        // Подставляем переменные в текст кнопок
        const processedButtons = broadcast.buttons.map((button) => ({
          text: this.substituteVariables(button.text, context),
          callback_data: button.callbackData,
        }));

        replyMarkup = {
          inline_keyboard: processedButtons.map((button) => [
            {
              text: button.text,
              callback_data: button.callback_data,
            },
          ]),
        };
      }

      for (const chatId of recipientChatIds) {
        try {
          this.logger.log(`Отправка сообщения пользователю ${chatId}`);

          const result = await this.telegramService.sendMessage(
            bot.token,
            chatId,
            processedText,
            {
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }
          );

          if (result) {
            sentCount++;
            this.logger.log(`✅ Сообщение отправлено пользователю ${chatId}`);
          } else {
            failedCount++;
            this.logger.warn(
              `❌ Не удалось отправить сообщение пользователю ${chatId}`
            );
          }

          // Добавляем небольшую задержку между отправками (защита от rate limit)
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          failedCount++;
          this.logger.error(
            `Ошибка отправки сообщения пользователю ${chatId}: ${error.message}`
          );
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

      this.logger.log(
        `Рассылка завершена: отправлено ${sentCount}, ошибок ${failedCount} из ${recipientChatIds.length} получателей`
      );
    } catch (error) {
      this.logger.error(`Ошибка при выполнении рассылки: ${error.message}`);
      session.variables[`broadcast_${currentNode.nodeId}_status`] = "failed";
      session.variables[`broadcast_${currentNode.nodeId}_error`] =
        error.message;
    }

    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
