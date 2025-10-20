import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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

@Injectable()
export class BotFlowsService {
  constructor(
    @InjectRepository(BotFlow)
    private botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private botFlowNodeRepository: Repository<BotFlowNode>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>
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

    return savedFlow;
  }

  async findAllFlows(botId: string, userId: string): Promise<BotFlow[]> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
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
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
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
      console.log("Flow сохранен с ID:", savedFlow.id);

      // Удаляем старые узлы и создаем новые
      console.log("Удаляем старые узлы для flow:", savedFlow.id);
      const deleteResult = await this.botFlowNodeRepository.delete({
        flowId: savedFlow.id,
      });
      console.log("Удалено узлов:", deleteResult.affected);

      console.log(
        "Создаем новые узлы:",
        updateFlowDto.flowData.nodes?.length || 0
      );
      await this.createFlowNodes(savedFlow.id, updateFlowDto.flowData.nodes);

      return savedFlow;
    }

    return this.botFlowRepository.save(flow);
  }

  async removeFlow(
    flowId: string,
    botId: string,
    userId: string
  ): Promise<void> {
    const flow = await this.findOneFlow(flowId, botId, userId);

    // Удаляем узлы flow
    await this.botFlowNodeRepository.delete({ flowId: flow.id });

    // Удаляем flow
    await this.botFlowRepository.remove(flow);
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
    return this.botFlowRepository.save(flow);
  }

  async deactivateFlow(
    flowId: string,
    botId: string,
    userId: string
  ): Promise<BotFlow> {
    const flow = await this.findOneFlow(flowId, botId, userId);

    // Деактивируем flow
    flow.status = FlowStatus.INACTIVE;
    return this.botFlowRepository.save(flow);
  }

  private async createFlowNodes(flowId: string, nodes: any[]): Promise<void> {
    if (!nodes || nodes.length === 0) {
      console.log("Нет узлов для создания");
      return;
    }

    console.log("Создаем узлы для flowId:", flowId);
    console.log(
      "Узлы:",
      nodes.map((n) => ({ id: n.id, type: n.type }))
    );

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

      console.log("Создаем узел:", nodeData);
      return this.botFlowNodeRepository.create(nodeData);
    });

    console.log("Сохраняем узлы в базу...");
    await this.botFlowNodeRepository.save(flowNodes);
    console.log("Узлы сохранены успешно");
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
      file: NodeType.FILE,
      random: NodeType.RANDOM,
      integration: NodeType.INTEGRATION,
      webhook: NodeType.WEBHOOK,
      new_message: NodeType.NEW_MESSAGE,
      endpoint: NodeType.ENDPOINT,
    };

    if (!typeMap[type]) {
      throw new BadRequestException(`Неподдерживаемый тип узла: ${type}`);
    }

    return typeMap[type];
  }
}
