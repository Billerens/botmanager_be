import { api } from "./api";

export interface Message {
  id: string;
  telegramMessageId: number;
  telegramChatId: string;
  telegramUserId: string;
  type: "incoming" | "outgoing";
  contentType:
    | "text"
    | "photo"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "voice"
    | "location"
    | "contact";
  text?: string;
  media?: {
    fileId: string;
    fileUniqueId: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
  };
  keyboard?: {
    type: "reply" | "inline";
    buttons: Array<{
      text: string;
      callbackData?: string;
      url?: string;
      webApp?: string;
    }>;
  };
  metadata?: {
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isBot?: boolean;
    replyToMessageId?: number;
    forwardFrom?: any;
  };
  isProcessed: boolean;
  processedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface MessageFilters {
  page?: number;
  limit?: number;
  type?: "incoming" | "outgoing";
}

export interface MessageStats {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  uniqueUsers: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
}

export interface MessagesResponse {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DialogResponse {
  messages: Message[];
  userInfo?: {
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isBot?: boolean;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const messagesService = {
  // Получить историю сообщений бота
  async getBotMessages(
    botId: string,
    filters: MessageFilters = {}
  ): Promise<MessagesResponse> {
    const params = new URLSearchParams();

    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.type) params.append("type", filters.type);

    const response = await api.get(
      `/messages/bot/${botId}?${params.toString()}`
    );
    return response.data;
  },

  // Получить диалог с конкретным пользователем
  async getDialog(
    botId: string,
    chatId: string,
    filters: { page?: number; limit?: number } = {}
  ): Promise<DialogResponse> {
    const params = new URLSearchParams();

    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());

    const response = await api.get(
      `/messages/bot/${botId}/dialog/${chatId}?${params.toString()}`
    );
    return response.data;
  },

  // Получить статистику сообщений бота
  async getBotMessageStats(botId: string): Promise<MessageStats> {
    const response = await api.get(`/messages/bot/${botId}/stats`);
    return response.data;
  },
};
