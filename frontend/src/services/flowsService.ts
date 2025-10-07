import { api } from "./api";
import { FlowData } from "@/types/flow";

export interface BotFlow {
  id: string;
  name: string;
  description?: string;
  flowData: FlowData;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  botId: string;
}

// Геттер для совместимости
export const getFlowIsActive = (flow: BotFlow): boolean => {
  return flow.status === "active";
};

export interface CreateFlowRequest {
  name: string;
  description?: string;
  flowData: FlowData;
}

export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  flowData?: FlowData;
}

export const flowsService = {
  async getFlows(botId: string): Promise<BotFlow[]> {
    const response = await api.get(`/bots/${botId}/flows`);
    return response.data;
  },

  async getFlow(botId: string, flowId: string): Promise<BotFlow> {
    const response = await api.get(`/bots/${botId}/flows/${flowId}`);
    return response.data;
  },

  async createFlow(botId: string, data: CreateFlowRequest): Promise<BotFlow> {
    const response = await api.post(`/bots/${botId}/flows`, data);
    return response.data;
  },

  async updateFlow(
    botId: string,
    flowId: string,
    data: UpdateFlowRequest
  ): Promise<BotFlow> {
    const response = await api.patch(`/bots/${botId}/flows/${flowId}`, data);
    return response.data;
  },

  async deleteFlow(botId: string, flowId: string): Promise<void> {
    await api.delete(`/bots/${botId}/flows/${flowId}`);
  },

  async activateFlow(botId: string, flowId: string): Promise<BotFlow> {
    const response = await api.post(`/bots/${botId}/flows/${flowId}/activate`);
    return response.data;
  },

  async deactivateFlow(botId: string, flowId: string): Promise<BotFlow> {
    const response = await api.post(
      `/bots/${botId}/flows/${flowId}/deactivate`
    );
    return response.data;
  },
};
