import { Injectable, Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { IMessageTransport } from "../bots/nodes/message-transport.interface";

/**
 * Транспорт симуляции: вместо Telegram API отправляет сообщения
 * через WebSocket в TelegramSimulator на фронтенде.
 *
 * Реализует IMessageTransport для подмены в BaseNodeHandler.
 */
@Injectable()
export class SimulationTransportService implements IMessageTransport {
  private readonly logger = new Logger(SimulationTransportService.name);

  /**
   * Отправить текстовое сообщение через WebSocket
   */
  async sendMessage(
    bot: any,
    chatId: string,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
      disable_web_page_preview?: boolean;
    } = {},
  ): Promise<void> {
    const socket = this.getSocket();
    if (!socket) return;

    socket.emit("simulation:bot_message", {
      text,
      parseMode: options.parse_mode,
      keyboard: this.normalizeKeyboard(options.reply_markup),
      replyToMessageId: options.reply_to_message_id,
    });

    this.logger.debug(`[SIM] Отправлено сообщение: "${text.substring(0, 80)}..."`);
  }

  /**
   * Отправить фото через WebSocket
   */
  async sendPhoto(
    bot: any,
    chatId: string,
    photoUrl: string,
    options: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    } = {},
  ): Promise<void> {
    const socket = this.getSocket();
    if (!socket) return;

    socket.emit("simulation:bot_photo", {
      photoUrl,
      caption: options.caption,
      parseMode: options.parse_mode,
      keyboard: this.normalizeKeyboard(options.reply_markup),
    });

    this.logger.debug(`[SIM] Отправлено фото: ${photoUrl}`);
  }

  /**
   * Отправить документ через WebSocket
   */
  async sendDocument(
    bot: any,
    chatId: string,
    document: string | Buffer,
    options: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    } = {},
  ): Promise<void> {
    const socket = this.getSocket();
    if (!socket) return;

    const documentUrl = typeof document === "string" ? document : "[binary]";

    socket.emit("simulation:bot_document", {
      documentUrl,
      caption: options.caption,
      parseMode: options.parse_mode,
    });

    this.logger.debug(`[SIM] Отправлен документ: ${documentUrl}`);
  }

  /**
   * Отправить chat action (typing) через WebSocket
   */
  async sendChatAction(
    bot: any,
    chatId: string,
    action: string,
  ): Promise<void> {
    const socket = this.getSocket();
    if (!socket) return;

    if (action === "typing") {
      socket.emit("simulation:typing");
    }
  }

  // -- Внутренний механизм привязки socket --

  /** Текущий socket для отправки (устанавливается SimulationService при выполнении) */
  private _socket: Socket | null = null;

  /**
   * Установить активный socket для текущего контекста выполнения.
   * Вызывается SimulationService перед executeNode.
   */
  setSocket(socket: Socket): void {
    this._socket = socket;
  }

  /**
   * Очистить socket
   */
  clearSocket(): void {
    this._socket = null;
  }

  private getSocket(): Socket | null {
    if (!this._socket) {
      this.logger.warn("[SIM] Socket не установлен, сообщение потеряно");
      return null;
    }
    return this._socket;
  }

  /**
   * Нормализует reply_markup в удобный для фронтенда формат
   */
  private normalizeKeyboard(replyMarkup: any): any | null {
    if (!replyMarkup) return null;

    if (replyMarkup.inline_keyboard) {
      return {
        type: "inline",
        buttons: replyMarkup.inline_keyboard.flat().map((btn: any) => ({
          text: btn.text,
          callbackData: btn.callback_data,
          url: btn.url,
          webApp: btn.web_app,
        })),
      };
    }

    if (replyMarkup.keyboard) {
      return {
        type: "reply",
        buttons: replyMarkup.keyboard.flat().map((btn: any) => ({
          text: typeof btn === "string" ? btn : btn.text,
          requestContact: btn.request_contact,
          requestLocation: btn.request_location,
        })),
        oneTime: replyMarkup.one_time_keyboard,
        resize: replyMarkup.resize_keyboard,
      };
    }

    return null;
  }
}
