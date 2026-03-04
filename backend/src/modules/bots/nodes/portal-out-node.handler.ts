import { Injectable } from "@nestjs/common";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";

@Injectable()
export class PortalOutNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "portal_out";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode } = context;

    this.logger.log(`[Portal Out] Passed through portal ${currentNode?.nodeId}`);
    
    // Portal Out works as a passthrough, moving to the next connected node
    if (currentNode) {
      await this.moveToNextNode(context, currentNode.nodeId);
    }
  }
}
