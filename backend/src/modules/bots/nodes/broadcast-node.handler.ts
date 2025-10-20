import { Injectable } from "@nestjs/common";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowContext } from "./base-node-handler.interface";

@Injectable()
export class BroadcastNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "broadcast";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;
    if (!currentNode?.data?.broadcast) {
      this.logger.warn("Данные broadcast не найдены");
      return;
    }

    const broadcast = currentNode.data.broadcast;

    // Сохраняем базовую информацию в переменные
    session.variables[`broadcast_${currentNode.nodeId}_text`] = broadcast.text;
    session.variables[`broadcast_${currentNode.nodeId}_buttons_count`] = String(
      broadcast.buttons?.length || 0
    );
    session.variables[`broadcast_${currentNode.nodeId}_recipient_type`] =
      broadcast.recipientType || "all";

    if (broadcast.recipientType === "specific" && broadcast.specificUsers) {
      session.variables[`broadcast_${currentNode.nodeId}_specific_users`] =
        JSON.stringify(broadcast.specificUsers);
    }

    if (broadcast.recipientType === "activity") {
      session.variables[`broadcast_${currentNode.nodeId}_activity_type`] =
        broadcast.activityType || "after";
      if (broadcast.activityDate) {
        session.variables[`broadcast_${currentNode.nodeId}_activity_date`] =
          broadcast.activityDate;
      }
    }

    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
