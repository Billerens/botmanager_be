import { Injectable } from "@nestjs/common";
import {
  INodeHandler,
  INodeHandlerService,
} from "./base-node-handler.interface";

@Injectable()
export class NodeHandlerService implements INodeHandlerService {
  private handlers = new Map<string, INodeHandler>();

  getHandler(nodeType: string): INodeHandler | null {
    return this.handlers.get(nodeType) || null;
  }

  registerHandler(nodeType: string, handler: INodeHandler): void {
    this.handlers.set(nodeType, handler);
  }

  /**
   * Получает все зарегистрированные типы узлов
   */
  getRegisteredNodeTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Проверяет, есть ли обработчик для указанного типа узла
   */
  hasHandler(nodeType: string): boolean {
    return this.handlers.has(nodeType);
  }
}
