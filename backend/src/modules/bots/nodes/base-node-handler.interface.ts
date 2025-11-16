import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { UserSession } from "../flow-execution.service";

export interface FlowContext {
  bot: any;
  user: any;
  message: any;
  session: UserSession;
  flow: BotFlow;
  currentNode?: BotFlowNode;
  // Флаг, указывающий, что узел был достигнут через переход от другого узла
  reachedThroughTransition?: boolean;
  // Групповой контекст
  groupSession?: any; // GroupSession entity
  isGroupContext?: boolean; // Флаг, что выполнение в контексте группы
}

export interface INodeHandler {
  /**
   * Выполняет обработку узла
   * @param context - контекст выполнения flow
   */
  execute(context: FlowContext): Promise<void>;

  /**
   * Проверяет, может ли данный обработчик обработать узел
   * @param nodeType - тип узла
   */
  canHandle(nodeType: string): boolean;
}

export interface INodeHandlerService {
  /**
   * Получает обработчик для указанного типа узла
   * @param nodeType - тип узла
   */
  getHandler(nodeType: string): INodeHandler | null;

  /**
   * Регистрирует обработчик для типа узла
   * @param nodeType - тип узла
   * @param handler - обработчик
   */
  registerHandler(nodeType: string, handler: INodeHandler): void;
}
