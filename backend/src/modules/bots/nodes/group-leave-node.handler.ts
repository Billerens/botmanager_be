import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Repository } from "typeorm";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowContext } from "./base-node-handler.interface";
import { GroupSessionService } from "../group-session.service";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";

@Injectable()
export class GroupLeaveNodeHandler extends BaseNodeHandler {
  constructor(
    private readonly groupSessionService: GroupSessionService,
    @InjectRepository(BotFlow) botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode) botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService,
    @InjectQueue("group-actions") private readonly groupActionsQueue: Queue
  ) {
    super(botFlowRepository, botFlowNodeRepository, telegramService, botsService, logger, messagesService, activityLogService);
  }

  canHandle(nodeType: string): boolean {
    return nodeType === "group_leave";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot } = context;

    if (!currentNode) return;

    this.logger.log(
      `Выполнение GROUP_LEAVE узла ${currentNode.nodeId} для пользователя ${session.userId}`
    );

    try {
      const { groupLeave } = currentNode.data;

      // Проверяем, что пользователь в группе
      if (!session.lobbyData?.groupSessionId) {
        this.logger.warn("Пользователь не в группе, пропускаем GROUP_LEAVE");
        await this.moveToNextNode(context, context.currentNode.nodeId);
        return;
      }

      const groupId = session.lobbyData.groupSessionId;
      const group = await this.groupSessionService.findById(groupId);

      if (!group) {
        this.logger.warn(`Группа ${groupId} не найдена`);
        // Очищаем lobbyData в любом случае
        session.lobbyData = undefined;
        await this.moveToNextNode(context, context.currentNode.nodeId);
        return;
      }

      // Уведомляем других участников если нужно
      if (groupLeave?.notifyOthers) {
        const message =
          groupLeave.notificationMessage ||
          `Участник покинул группу. Осталось участников: ${group.participantCount - 1}`;

        // Добавляем в очередь
        const participantIds =
          await this.groupSessionService.getParticipantIds(groupId);

        await this.groupActionsQueue.add("broadcast", {
          groupId: groupId,
          botId: bot.id,
          botToken: bot.token,
          message,
          excludeUserId: session.userId, // Не отправляем самому себе
          participantIds,
        });
      }

      // Удаляем пользователя из группы
      await this.groupSessionService.removeParticipant(groupId, session.userId);

      // Очищаем lobbyData (уже очищено в service, но для уверенности)
      session.lobbyData = undefined;

      this.logger.log(
        `Пользователь ${session.userId} покинул группу ${groupId}`
      );

      // Отправляем подтверждение пользователю
      const decryptedToken = this.botsService.decryptToken(bot.token);
      await this.telegramService.sendMessage(
        decryptedToken,
        session.chatId,
        "Вы покинули группу."
      );

      // Проверяем, нужно ли архивировать пустую группу
      const cleanupIfEmpty = groupLeave?.cleanupIfEmpty !== false; // по умолчанию true

      if (cleanupIfEmpty) {
        const updatedGroup = await this.groupSessionService.findById(groupId);
        if (updatedGroup && updatedGroup.participantCount === 0) {
          await this.groupSessionService.archive(groupId);
          this.logger.log(`Группа ${groupId} заархивирована (пустая)`);
        }
      }

      // Переходим к следующему узлу
      await this.moveToNextNode(context, context.currentNode.nodeId);
    } catch (error) {
      this.logger.error(`Ошибка в GROUP_LEAVE узле:`, error);
      await this.handleNodeError(context, error);
    }
  }
}

