import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowContext } from "./base-node-handler.interface";
import { GroupSessionService } from "../group-session.service";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";

@Injectable()
export class GroupCreateNodeHandler extends BaseNodeHandler {
  constructor(
    private readonly groupSessionService: GroupSessionService,
    @InjectRepository(BotFlow) botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService
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
    return nodeType === "group_create";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot } = context;

    if (!currentNode) return;

    this.logger.log(
      `Выполнение GROUP_CREATE узла ${currentNode.nodeId} для пользователя ${session.userId}`
    );

    try {
      const { groupCreate } = currentNode.data;

      if (!groupCreate) {
        throw new Error("Отсутствуют данные groupCreate в узле");
      }

      // Создаем новую группу
      const group = await this.groupSessionService.create(
        bot.id,
        context.flow.id,
        session.userId,
        groupCreate.metadata
      );

      this.logger.log(`Создана группа ${group.id}`);

      // Если указано имя переменной, сохраняем ID группы
      if (groupCreate.variableName) {
        session.variables[groupCreate.variableName] = group.id;
      }

      // Автоматически добавляем создателя в группу
      // (уже добавлен в service.create, но обновим сессию)
      session.lobbyData = {
        groupSessionId: group.id,
        role: "host",
        joinedAt: new Date(),
        participantVariables: {},
      };

      // Переходим к следующему узлу
      await this.moveToNextNode(context, context.currentNode.nodeId);
    } catch (error) {
      this.logger.error(`Ошибка в GROUP_CREATE узле:`, error);
      await this.handleNodeError(context, error);
    }
  }
}
