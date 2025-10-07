import { api } from "./api";

export interface Bot {
  id: string;
  name: string;
  description?: string;
  username: string;
  status: "active" | "inactive" | "error";
  totalUsers: number;
  totalMessages: number;
  totalLeads: number;
  webhookUrl?: string;
  isWebhookSet: boolean;
  lastError?: string;
  lastErrorAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBotData {
  name: string;
  description?: string;
  token: string;
}

export interface UpdateBotData {
  name?: string;
  description?: string;
}

export interface BotStats {
  totalUsers: number;
  totalMessages: number;
  totalLeads: number;
}

export const botsService = {
  // Получить список всех ботов
  async getBots(): Promise<Bot[]> {
    const response = await api.get("/bots");
    return response.data;
  },

  // Получить бота по ID
  async getBot(id: string): Promise<Bot> {
    const response = await api.get(`/bots/${id}`);
    return response.data;
  },

  // Создать нового бота
  async createBot(data: CreateBotData): Promise<Bot> {
    console.log("Creating bot:", data);
    const response = await api.post("/bots", data);
    return response.data;
  },

  // Обновить бота
  async updateBot(id: string, data: UpdateBotData): Promise<Bot> {
    const response = await api.patch(`/bots/${id}`, data);
    return response.data;
  },

  // Удалить бота
  async deleteBot(id: string): Promise<void> {
    await api.delete(`/bots/${id}`);
  },

  // Активировать бота
  async activateBot(id: string): Promise<Bot> {
    const response = await api.patch(`/bots/${id}/activate`);
    return response.data;
  },

  // Деактивировать бота
  async deactivateBot(id: string): Promise<Bot> {
    const response = await api.patch(`/bots/${id}/deactivate`);
    return response.data;
  },

  // Получить статистику бота
  async getBotStats(id: string): Promise<BotStats> {
    const response = await api.get(`/bots/${id}/stats`);
    return response.data;
  },
};
