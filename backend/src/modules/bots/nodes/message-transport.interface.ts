/**
 * Абстракция транспортного слоя для отправки сообщений.
 *
 * Production:  TelegramMessageTransport  → Telegram Bot API + сохранение в БД
 * Simulation:  SimulationMessageTransport → WebSocket emit (без сохранения)
 *
 * Используется в BaseNodeHandler через FlowContext.transport.
 * Если transport не задан — fallback на прямой вызов TelegramService (обратная совместимость).
 */
export interface IMessageTransport {
  /**
   * Отправить текстовое сообщение
   */
  sendMessage(
    bot: any,
    chatId: string,
    text: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
      disable_web_page_preview?: boolean;
    },
  ): Promise<void>;

  /**
   * Отправить фото
   */
  sendPhoto(
    bot: any,
    chatId: string,
    photoUrl: string,
    options?: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    },
  ): Promise<void>;

  /**
   * Отправить документ
   */
  sendDocument(
    bot: any,
    chatId: string,
    document: string | Buffer,
    options?: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    },
  ): Promise<void>;

  /**
   * Отправить действие чата (typing и т.д.)
   */
  sendChatAction?(
    bot: any,
    chatId: string,
    action: string,
  ): Promise<void>;
}
