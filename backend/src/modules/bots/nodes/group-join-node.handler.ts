import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
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
export class GroupJoinNodeHandler extends BaseNodeHandler {
  constructor(
    private readonly groupSessionService: GroupSessionService,
    @InjectRepository(BotFlow) botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode) botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService
  ) {
    super(botFlowRepository, botFlowNodeRepository, telegramService, botsService, logger, messagesService, activityLogService);
  }

  canHandle(nodeType: string): boolean {
    return nodeType === "group_join";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot } = context;

    if (!currentNode) return;

    this.logger.log(
      `Выполнение GROUP_JOIN узла ${currentNode.nodeId} для пользователя ${session.userId}`
    );

    try {
      const { groupJoin } = currentNode.data;

      if (!groupJoin) {
        throw new Error("Отсутствуют данные groupJoin в узле");
      }

      // Получаем ID группы из переменной или константы
      const groupId = this.resolveVariable(
        groupJoin.groupIdSource,
        context.session.variables
      );

      if (!groupId) {
        throw new Error(
          `Не удалось получить ID группы из ${groupJoin.groupIdSource}`
        );
      }

      this.logger.log(`Попытка присоединения к группе ${groupId}`);

      // Получаем группу
      const group = await this.groupSessionService.findById(groupId);

      if (!group) {
        await this.sendMessage(
          context,
          "Группа не найдена или больше не существует."
        );
        await this.moveToNextNode(context, context.currentNode.nodeId);
        return;
      }

      // Проверяем, не полна ли группа
      if (group.isFull) {
        this.logger.warn(`Группа ${groupId} полна`);

        const onFullAction = groupJoin.onFullAction || "reject";

        if (onFullAction === "reject") {
        await this.sendMessage(
          context,
          "К сожалению, группа уже полна. Попробуйте позже."
        );
        await this.moveToNextNode(context, context.currentNode.nodeId);
        return;
        } else if (onFullAction === "create_new") {
          // Создаем новую группу автоматически
          this.logger.log("Создаем новую группу т.к. текущая полна");
          const newGroup = await this.groupSessionService.create(
            bot.id,
            context.flow.id,
            session.userId,
            group.metadata
          );

          session.variables[groupJoin.groupIdSource] = newGroup.id;

          session.lobbyData = {
            groupSessionId: newGroup.id,
            role: groupJoin.role || "participant",
            joinedAt: new Date(),
            participantVariables: {},
          };

          await this.sendMessage(
            context,
            `Создана новая группа. ID: ${newGroup.id}`
          );
          await this.moveToNextNode(context, context.currentNode.nodeId);
          return;
        }
        // onFullAction === "queue" пока не реализуем, просто отклоняем
      }

      // Добавляем пользователя в группу
      await this.groupSessionService.addParticipant(groupId, session.userId);

      // Обновляем сессию пользователя
      session.lobbyData = {
        groupSessionId: groupId,
        role: groupJoin.role || "participant",
        joinedAt: new Date(),
        participantVariables: session.lobbyData?.participantVariables || {},
      };

      this.logger.log(
        `Пользователь ${session.userId} успешно присоединился к группе ${groupId}`
      );

      await this.sendMessage(
        context,
        `Вы присоединились к группе. Участников: ${group.participantCount + 1}`
      );

      // Переходим к следующему узлу
      await this.moveToNextNode(context, context.currentNode.nodeId);
    } catch (error) {
      this.logger.error(`Ошибка в GROUP_JOIN узле:`, error);
      await this.handleNodeError(context, error);
    }
  }

  private async sendMessage(
    context: FlowContext,
    text: string
  ): Promise<void> {
    const decryptedToken = this.botsService.decryptToken(context.bot.token);
    await this.telegramService.sendMessage(
      decryptedToken,
      context.session.chatId,
      text
    );
  }

  private resolveVariable(
    source: string,
    variables: Record<string, any>
  ): string | null {
    // Если начинается с {, это переменная
    if (source.startsWith("{") && source.endsWith("}")) {
      const varName = source.slice(1, -1);
      return variables[varName] || null;
    }
    // Иначе это константа
    return source;
  }
}

