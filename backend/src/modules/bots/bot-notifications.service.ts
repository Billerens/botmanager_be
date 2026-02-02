import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelegramService } from "../telegram/telegram.service";
import { AssistantBotService } from "../assistant-bot/assistant-bot.service";
import { BotInvitation } from "../../database/entities/bot-invitation.entity";
import { Bot } from "../../database/entities/bot.entity";
import {
  PermissionAction,
  BotEntity,
} from "../../database/entities/bot-user-permission.entity";

@Injectable()
export class BotNotificationsService {
  private readonly logger = new Logger(BotNotificationsService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
    private readonly assistantBotService: AssistantBotService
  ) {
    this.frontendUrl = this.configService.get(
      "FRONTEND_URL",
      "https://botmanagertest.online"
    );
  }

  /**
   * Отправляет уведомление о приглашении в Telegram
   */
  async sendInvitationNotification(
    invitation: BotInvitation,
    message?: string
  ): Promise<void> {
    try {
      const invitationUrl = `${this.frontendUrl}/invitations/${invitation.invitationToken}`;

      let notificationText = `
🤖 <b>Вас пригласили управлять ботом!</b>

📝 <b>Бот:</b> ${invitation.bot.name}
👤 <b>Пригласивший:</b> ${invitation.invitedByUser.firstName || ""} ${invitation.invitedByUser.lastName || ""}

🔐 <b>Предоставляемые права:</b>
${this.formatPermissions(invitation.permissions)}
`;

      if (message) {
        notificationText += `\n💬 <b>Сообщение:</b> ${message}`;
      }

      notificationText += `

🔗 <b>Для принятия приглашения:</b>
1. Перейдите по ссылке: ${invitationUrl}
2. Или используйте команду в боте: <code>/accept_invitation ${invitation.invitationToken}</code>

⏰ <b>Срок действия:</b> ${invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString("ru-RU") : "Не ограничен"}
`;

      // Создаем клавиатуру с кнопками
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: "✅ Принять приглашение",
              url: invitationUrl,
            },
          ],
          [
            {
              text: "❌ Отклонить",
              callback_data: `decline_invitation_${invitation.invitationToken}`,
            },
          ],
        ],
      };

      // Получаем токен assistant-bot для отправки уведомления о приглашении
      const botToken = await this.getBotToken(invitation.botId);

      if (!botToken) {
        this.logger.warn(
          `Не удалось получить токен бота ${invitation.botId} для отправки уведомления`
        );
        return;
      }

      await this.telegramService.sendMessage(
        botToken,
        invitation.invitedTelegramId,
        notificationText,
        {
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        }
      );

      this.logger.log(
        `Отправлено уведомление о приглашении пользователю ${invitation.invitedTelegramId}`
      );
    } catch (error) {
      this.logger.error(`Ошибка отправки уведомления о приглашении:`, error);
    }
  }

  /**
   * Отправляет уведомление о принятии приглашения
   */
  async sendInvitationAcceptedNotification(
    invitation: BotInvitation
  ): Promise<void> {
    try {
      const notificationText = `
✅ <b>Приглашение принято!</b>

👤 Пользователь с Telegram ID <code>${invitation.invitedTelegramId}</code> принял ваше приглашение к управлению ботом "${invitation.bot.name}".

🔐 <b>Предоставленные права:</b>
${this.formatPermissions(invitation.permissions)}
`;

      // Отправляем уведомление пригласившему пользователю
      const botToken = await this.getBotToken(invitation.botId);
      if (botToken) {
        await this.telegramService.sendMessage(
          botToken,
          invitation.invitedByUser.telegramId,
          notificationText,
          {
            parse_mode: "HTML",
          }
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки уведомления о принятии приглашения:`,
        error
      );
    }
  }

  /**
   * Отправляет уведомление об отклонении приглашения
   */
  async sendInvitationDeclinedNotification(
    invitation: BotInvitation
  ): Promise<void> {
    try {
      const notificationText = `
❌ <b>Приглашение отклонено</b>

👤 Пользователь с Telegram ID <code>${invitation.invitedTelegramId}</code> отклонил приглашение к управлению ботом "${invitation.bot.name}".
`;

      const botToken = await this.getBotToken(invitation.botId);
      if (botToken) {
        await this.telegramService.sendMessage(
          botToken,
          invitation.invitedByUser.telegramId,
          notificationText,
          {
            parse_mode: "HTML",
          }
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки уведомления об отклонении приглашения:`,
        error
      );
    }
  }

  /**
   * Отправляет уведомление о добавлении пользователя к боту
   */
  async sendUserAddedNotification(
    bot: Bot,
    addedUserId: string,
    addedByUserId: string,
    permissions: Record<BotEntity, PermissionAction[]>
  ): Promise<void> {
    try {
      // Получаем информацию о пользователях
      const addedUser = await this.getUserInfo(addedUserId);
      const addedByUser = await this.getUserInfo(addedByUserId);

      if (!addedUser || !addedByUser) return;

      const notificationText = `
👥 <b>Вы добавлены к управлению ботом!</b>

📝 <b>Бот:</b> ${bot.name}
👤 <b>Добавил:</b> ${addedByUser.firstName || ""} ${addedByUser.lastName || ""}

🔐 <b>Ваши права:</b>
${this.formatPermissions(permissions)}

🎉 Теперь вы можете управлять этим ботом через веб-интерфейс!
`;

      const botToken = await this.getBotToken(bot.id);
      if (botToken && addedUser.telegramId) {
        await this.telegramService.sendMessage(
          botToken,
          addedUser.telegramId,
          notificationText,
          {
            parse_mode: "HTML",
          }
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки уведомления о добавлении пользователя:`,
        error
      );
    }
  }

  /**
   * Отправляет уведомление об удалении пользователя из бота
   */
  async sendUserRemovedNotification(
    bot: Bot,
    removedUserId: string,
    removedByUserId: string
  ): Promise<void> {
    try {
      const removedUser = await this.getUserInfo(removedUserId);
      const removedByUser = await this.getUserInfo(removedByUserId);

      if (!removedUser || !removedByUser) return;

      const notificationText = `
🚫 <b>Вы удалены из управления ботом</b>

📝 <b>Бот:</b> ${bot.name}
👤 <b>Удалил:</b> ${removedByUser.firstName || ""} ${removedByUser.lastName || ""}

😔 Доступ к управлению этим ботом прекращен.
`;

      const botToken = await this.getBotToken(bot.id);
      if (botToken && removedUser.telegramId) {
        await this.telegramService.sendMessage(
          botToken,
          removedUser.telegramId,
          notificationText,
          {
            parse_mode: "HTML",
          }
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки уведомления об удалении пользователя:`,
        error
      );
    }
  }

  /**
   * Форматирует разрешения для отображения в сообщении
   */
  private formatPermissions(
    permissions: Record<BotEntity, PermissionAction[]>
  ): string {
    const entityLabels: Record<BotEntity, string> = {
      [BotEntity.BOT_SETTINGS]: "Настройки бота",
      [BotEntity.FLOWS]: "Потоки",
      [BotEntity.MESSAGES]: "Сообщения",
      [BotEntity.LEADS]: "Лиды",
      [BotEntity.ANALYTICS]: "Аналитика",
      [BotEntity.BOT_USERS]: "Пользователи бота",
      [BotEntity.CUSTOM_DATA]: "Кастомные данные (базы данных)",
    };

    const actionLabels: Record<PermissionAction, string> = {
      [PermissionAction.READ]: "просмотр",
      [PermissionAction.CREATE]: "создание",
      [PermissionAction.UPDATE]: "редактирование",
      [PermissionAction.DELETE]: "удаление",
    };

    let result = "";
    Object.entries(permissions).forEach(([entity, actions]) => {
      if (actions.length > 0) {
        const entityName = entityLabels[entity as BotEntity] || entity;
        const actionNames = actions
          .map((action) => actionLabels[action])
          .join(", ");
        result += `• ${entityName}: ${actionNames}\n`;
      }
    });

    return result || "Нет предоставленных прав";
  }

  /**
   * Получает токен бота-ассистента для отправки системных уведомлений
   * Все уведомления отправляются через assistant-bot, а не через управляемые боты
   */
  private async getBotToken(botId: string): Promise<string | null> {
    try {
      const botToken = this.assistantBotService.getBotToken();
      if (!botToken) {
        this.logger.error(`Токен assistant-bot не найден`);
        return null;
      }
      return botToken;
    } catch (error) {
      this.logger.error(`Ошибка получения токена assistant-bot:`, error);
      return null;
    }
  }

  /**
   * Получает информацию о пользователе
   */
  private async getUserInfo(userId: string): Promise<any> {
    // TODO: Реализовать получение информации о пользователе
    // Пока возвращаем null
    return null;
  }
}
