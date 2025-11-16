import { Injectable } from "@nestjs/common";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowContext } from "./base-node-handler.interface";
import { GroupSessionService } from "../group-session.service";

@Injectable()
export class GroupCreateNodeHandler extends BaseNodeHandler {
  constructor(private readonly groupSessionService: GroupSessionService) {
    super();
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
      await this.moveToNextNode(context);
    } catch (error) {
      this.logger.error(`Ошибка в GROUP_CREATE узле:`, error);
      await this.handleNodeError(context, error);
    }
  }
}

