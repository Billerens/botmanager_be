import { Injectable } from "@nestjs/common";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";

@Injectable()
export class PortalInNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "portal_in";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode } = context;

    if (!currentNode || !currentNode.data || !currentNode.data.portalIn) {
      this.logger.error(`[Portal In] Missing configuration for node ${currentNode?.nodeId}`);
      return;
    }

    const targetNodeId = currentNode.data.portalIn.targetNodeId;

    if (!targetNodeId) {
      this.logger.error(`[Portal In] Target node ID is not set for node ${currentNode.nodeId}`);
      return;
    }

    // Protection against infinite loops. Max 10 consecutive jumps.
    const ctx = context as any;
    if (typeof ctx.__portalJumpCount === "undefined") {
      ctx.__portalJumpCount = 0;
    }
    
    ctx.__portalJumpCount += 1;

    if (ctx.__portalJumpCount > 10) {
      this.logger.error(`[Portal In] Max portal jump limit reached (10) for node ${currentNode.nodeId}. Possible infinite loop detected.`);
      // Break the loop
      return;
    }

    this.logger.log(`[Portal In] Jumping to target node ${targetNodeId}`);
    
    await this.moveToNode(context, targetNodeId);
  }
}
