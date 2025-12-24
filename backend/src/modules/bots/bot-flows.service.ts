import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow, FlowStatus } from "../../database/entities/bot-flow.entity";
import {
  BotFlowNode,
  NodeType,
} from "../../database/entities/bot-flow-node.entity";
import { Bot } from "../../database/entities/bot.entity";
import { CreateFlowDto, UpdateFlowDto, FlowDataDto } from "./dto/flow.dto";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { FlowExecutionService } from "./flow-execution.service";

@Injectable()
export class BotFlowsService {
  constructor(
    @InjectRepository(BotFlow)
    private botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private botFlowNodeRepository: Repository<BotFlowNode>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => FlowExecutionService))
    private flowExecutionService: FlowExecutionService
  ) {}

  async createFlow(
    createFlowDto: CreateFlowDto,
    botId: string,
    userId: string
  ): Promise<BotFlow> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Создаем flow
    const flow = this.botFlowRepository.create({
      name: createFlowDto.name,
      description: createFlowDto.description,
      botId,
      flowData: {
        ...createFlowDto.flowData,
        viewport: createFlowDto.flowData.viewport || { x: 0, y: 0, zoom: 1 },
      },
    });

    const savedFlow = await this.botFlowRepository.save(flow);

    // Создаем узлы flow
    await this.createFlowNodes(savedFlow.id, createFlowDto.flowData.nodes);

    // Логируем создание flow
    this.activityLogService
      .create({
        type: ActivityType.FLOW_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создан диалог "${savedFlow.name}"`,
        userId,
        botId,
        metadata: {
          flowId: savedFlow.id,
          flowName: savedFlow.name,
          nodesCount: createFlowDto.flowData.nodes?.length || 0,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования создания flow:", error);
      });

    return savedFlow;
  }

  async findAllFlows(botId: string, userId: string): Promise<BotFlow[]> {
    // Проверяем, что бот существует (права доступа проверены guard'ом)
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    return this.botFlowRepository.find({
      where: { botId },
      order: { createdAt: "DESC" },
    });
  }

  async findOneFlow(
    flowId: string,
    botId: string,
    userId: string
  ): Promise<BotFlow> {
    // Проверяем, что бот существует (права доступа проверены guard'ом)
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const flow = await this.botFlowRepository.findOne({
      where: { id: flowId, botId },
      relations: ["nodes"],
    });

    if (!flow) {
      throw new NotFoundException("Диалог не найден");
    }

    return flow;
  }

  async updateFlow(
    flowId: string,
    updateFlowDto: UpdateFlowDto,
    botId: string,
    userId: string
  ): Promise<BotFlow> {
    const flow = await this.findOneFlow(flowId, botId, userId);

    // Обновляем данные flow
    if (updateFlowDto.name !== undefined) {
      flow.name = updateFlowDto.name;
    }
    if (updateFlowDto.description !== undefined) {
      flow.description = updateFlowDto.description;
    }
    if (updateFlowDto.flowData !== undefined) {
      flow.flowData = {
        ...updateFlowDto.flowData,
        viewport: updateFlowDto.flowData.viewport || { x: 0, y: 0, zoom: 1 },
      };

      // Сначала сохраняем flow
      const savedFlow = await this.botFlowRepository.save(flow);

      // Удаляем старые узлы и создаем новые
      await this.botFlowNodeRepository.delete({
        flowId: savedFlow.id,
      });

      await this.createFlowNodes(savedFlow.id, updateFlowDto.flowData.nodes);

      // Если Flow активен, сбрасываем все сессии бота
      if (savedFlow.status === FlowStatus.ACTIVE) {
        await this.flowExecutionService.resetBotSessions(botId);
      }

      // Логируем обновление flow
      this.activityLogService
        .create({
          type: ActivityType.FLOW_UPDATED,
          level: ActivityLevel.INFO,
          message: `Обновлен диалог "${savedFlow.name}"`,
          userId,
          botId,
          metadata: {
            flowId: savedFlow.id,
            flowName: savedFlow.name,
            nodesCount: updateFlowDto.flowData.nodes?.length || 0,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования обновления flow:", error);
        });

      return savedFlow;
    }

    const updatedFlow = await this.botFlowRepository.save(flow);

    // Если Flow активен, сбрасываем все сессии бота
    if (updatedFlow.status === FlowStatus.ACTIVE) {
      await this.flowExecutionService.resetBotSessions(botId);
    }

    // Логируем обновление flow (без изменения узлов)
    this.activityLogService
      .create({
        type: ActivityType.FLOW_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлен диалог "${updatedFlow.name}"`,
        userId,
        botId,
        metadata: {
          flowId: updatedFlow.id,
          flowName: updatedFlow.name,
          changes: {
            name: updateFlowDto.name,
            description: updateFlowDto.description,
          },
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования обновления flow:", error);
      });

    return updatedFlow;
  }

  async removeFlow(
    flowId: string,
    botId: string,
    userId: string
  ): Promise<void> {
    const flow = await this.findOneFlow(flowId, botId, userId);

    const flowData = {
      id: flow.id,
      name: flow.name,
    };

    // Удаляем узлы flow
    await this.botFlowNodeRepository.delete({ flowId: flow.id });

    // Удаляем flow
    await this.botFlowRepository.remove(flow);

    // Логируем удаление flow
    this.activityLogService
      .create({
        type: ActivityType.FLOW_DELETED,
        level: ActivityLevel.WARNING,
        message: `Удален диалог "${flowData.name}"`,
        userId,
        botId,
        metadata: {
          flowId: flowData.id,
          flowName: flowData.name,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования удаления flow:", error);
      });
  }

  async activateFlow(
    flowId: string,
    botId: string,
    userId: string
  ): Promise<BotFlow> {
    const flow = await this.findOneFlow(flowId, botId, userId);

    // Деактивируем все остальные flow для этого бота
    await this.botFlowRepository.update(
      { botId, status: FlowStatus.ACTIVE },
      { status: FlowStatus.INACTIVE }
    );

    // Активируем текущий flow
    flow.status = FlowStatus.ACTIVE;
    const savedFlow = await this.botFlowRepository.save(flow);

    // Сбрасываем все сессии бота при активации Flow
    await this.flowExecutionService.resetBotSessions(botId);

    // Логируем активацию flow
    this.activityLogService
      .create({
        type: ActivityType.FLOW_ACTIVATED,
        level: ActivityLevel.SUCCESS,
        message: `Активирован диалог "${savedFlow.name}"`,
        userId,
        botId,
        metadata: {
          flowId: savedFlow.id,
          flowName: savedFlow.name,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования активации flow:", error);
      });

    return savedFlow;
  }

  async deactivateFlow(
    flowId: string,
    botId: string,
    userId: string
  ): Promise<BotFlow> {
    const flow = await this.findOneFlow(flowId, botId, userId);

    // Деактивируем flow
    flow.status = FlowStatus.INACTIVE;
    const savedFlow = await this.botFlowRepository.save(flow);

    // Логируем деактивацию flow
    this.activityLogService
      .create({
        type: ActivityType.FLOW_DEACTIVATED,
        level: ActivityLevel.WARNING,
        message: `Деактивирован диалог "${savedFlow.name}"`,
        userId,
        botId,
        metadata: {
          flowId: savedFlow.id,
          flowName: savedFlow.name,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования деактивации flow:", error);
      });

    return savedFlow;
  }

  private async createFlowNodes(flowId: string, nodes: any[]): Promise<void> {
    if (!nodes || nodes.length === 0) {
      return;
    }

    const flowNodes = nodes.map((node) => {
      // Маппим строковые типы на enum
      const nodeType = this.mapStringToNodeType(node.type);

      const nodeData = {
        flowId,
        nodeId: node.id,
        type: nodeType,
        name: node.data?.label || `Узел ${node.type}`,
        position: node.position,
        data: node.data,
      };

      return this.botFlowNodeRepository.create(nodeData);
    });

    await this.botFlowNodeRepository.save(flowNodes);
  }

  private mapStringToNodeType(type: string): NodeType {
    const typeMap: Record<string, NodeType> = {
      start: NodeType.START,
      message: NodeType.MESSAGE,
      keyboard: NodeType.KEYBOARD,
      condition: NodeType.CONDITION,
      api: NodeType.API,
      end: NodeType.END,
      form: NodeType.FORM,
      delay: NodeType.DELAY,
      variable: NodeType.VARIABLE,
      database: NodeType.DATABASE,
      file: NodeType.FILE,
      random: NodeType.RANDOM,
      integration: NodeType.INTEGRATION,
      webhook: NodeType.WEBHOOK,
      new_message: NodeType.NEW_MESSAGE,
      endpoint: NodeType.ENDPOINT,
      broadcast: NodeType.BROADCAST,
      group: NodeType.GROUP,
      location: NodeType.LOCATION,
      calculator: NodeType.CALCULATOR,
      transform: NodeType.TRANSFORM,
      group_create: NodeType.GROUP_CREATE,
      group_join: NodeType.GROUP_JOIN,
      group_action: NodeType.GROUP_ACTION,
      group_leave: NodeType.GROUP_LEAVE,
      // AI узлы
      ai_single: NodeType.AI_SINGLE,
      ai_chat: NodeType.AI_CHAT,
    };

    if (!typeMap[type]) {
      throw new BadRequestException(`Неподдерживаемый тип узла: ${type}`);
    }

    return typeMap[type];
  }
}
