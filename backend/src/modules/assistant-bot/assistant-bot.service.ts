import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";
import { AuthService } from "../auth/auth.service";
import { AdminTelegramService } from "../admin/services/admin-telegram.service";

import { User } from "../../database/entities/user.entity";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
  };
}

/**
 * Сервис для бота-ассистента BotManager
 * Обрабатывает команды /start и помогает пользователям с регистрацией
 *
 * OnModuleInit - автоматически устанавливает webhook при старте модуля
 */
@Injectable()
export class AssistantBotService implements OnModuleInit {
  private readonly logger = new Logger(AssistantBotService.name);
  private readonly botToken: string;
  private readonly telegramApiUrl: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private authService: AuthService,
    @Inject(forwardRef(() => AdminTelegramService))
    private adminTelegramService: AdminTelegramService
  ) {
    this.botToken = this.configService.get<string>("app.telegramBotToken");
    this.telegramApiUrl = this.configService.get<string>(
      "TELEGRAM_BOT_API_URL",
      "https://api.telegram.org/bot"
    );

    if (!this.botToken) {
      this.logger.warn(
        "TELEGRAM_BOT_TOKEN не установлен. Бот-ассистент будет недоступен."
      );
    }
  }

  /**
   * Автоматически вызывается NestJS при инициализации модуля
   * Устанавливает webhook для бота
   */
  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn("Пропуск установки webhook - токен не настроен");
      return;
    }

    try {
      this.logger.log("🤖 Автоматическая установка webhook бота-ассистента...");
      await this.setupWebhook();
      this.logger.log("🎉 Бот-ассистент готов к работе!");
    } catch (error) {
      this.logger.warn(`⚠️ Не удалось установить webhook: ${error.message}`);
      this.logger.warn("📝 Webhook можно установить вручную через API");
    }
  }

  private getBotApiUrl(): string {
    return `${this.telegramApiUrl}${this.botToken}`;
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      this.logger.log(`📩 Получено обновление: ${JSON.stringify(update)}`);

      if (update.message?.text) {
        await this.handleMessage(update.message);
      }
    } catch (error) {
      this.logger.error(
        `❌ Ошибка обработки обновления: ${error.message}`,
        error.stack
      );
    }
  }

  private async handleMessage(
    message: TelegramUpdate["message"]
  ): Promise<void> {
    if (!message) return;

    const { text, from, chat } = message;
    const telegramId = from.id.toString();

    this.logger.log(`📨 Сообщение от ${telegramId}: ${text}`);

    // Обрабатываем команды
    if (text === "/start") {
      this.logger.log(`🚀 Команда /start от пользователя ${telegramId}`);
      await this.handleStartCommand(telegramId, from, chat);
    } else if (text.startsWith("/admin_")) {
      // Админ-команды
      this.logger.log(`🔐 Админ-команда от ${telegramId}: ${text}`);
      await this.handleAdminCommand(text, telegramId, chat.id, from);
    } else {
      this.logger.log(`ℹ️ Неизвестная команда: ${text}`);
      // Показываем справку по доступным командам
      if (this.adminTelegramService.canManageAdmins(telegramId)) {
        await this.sendMessage(
          chat.id,
          `Доступные команды:\n• /start - Начать работу\n• /admin_help - Справка по управлению админами`,
          { parse_mode: "Markdown" }
        );
      }
    }
  }

  private async handleStartCommand(
    telegramId: string,
    from: TelegramUpdate["message"]["from"],
    chat: TelegramUpdate["message"]["chat"]
  ): Promise<void> {
    try {
      this.logger.log(`🔍 Поиск пользователя с telegramId: ${telegramId}`);

      // Проверяем, существует ли пользователь в базе данных
      const existingUser = await this.userRepository.findOne({
        where: { telegramId },
      });

      if (existingUser) {
        // Пользователь уже зарегистрирован
        this.logger.log(`✅ Пользователь найден: ${existingUser.id}`);
        await this.sendWelcomeBackMessage(chat.id, from.first_name);
      } else {
        // Новый пользователь - автоматически регистрируем его
        this.logger.log(`📝 Новый пользователь, автоматическая регистрация`);
        await this.autoRegisterUser(
          telegramId,
          from.first_name,
          from.last_name,
          from.username,
          chat.id
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Ошибка обработки /start для ${telegramId}: ${error.message}`,
        error.stack
      );
    }
  }

  private async sendWelcomeBackMessage(
    chatId: number,
    firstName: string
  ): Promise<void> {
    const message = `Привет, ${firstName}! 👋\n\nДобро пожаловать обратно в BotManager! Ваш аккаунт зарегистрирован и готов к использованию.\n\n🔗 Веб-интерфейс: ${this.configService.get("app.frontendUrl")}\n\n💡 Используйте свои учетные данные для входа или авторизуйтесь через Telegram.`;

    this.logger.log(`📤 Отправка приветствия пользователю ${chatId}`);
    await this.sendMessage(chatId, message);
  }

  private async autoRegisterUser(
    telegramId: string,
    firstName?: string,
    lastName?: string,
    username?: string,
    chatId?: number
  ): Promise<void> {
    try {
      // Генерируем временный пароль
      const tempPassword = this.generateTempPassword();

      this.logger.log(
        `🔐 Автоматическая регистрация пользователя ${telegramId}`
      );

      // Регистрируем пользователя через AuthService
      const result = await this.authService.register({
        telegramId,
        telegramUsername: username,
        firstName: firstName || "",
        lastName: lastName || "",
        password: tempPassword,
      });

      if (result.user) {
        this.logger.log(
          `✅ Пользователь ${telegramId} автоматически зарегистрирован`
        );

        // Отправляем сообщение с учетными данными
        if (chatId) {
          await this.sendRegistrationSuccessMessage(
            chatId,
            firstName || "Пользователь",
            telegramId,
            tempPassword
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Ошибка автоматической регистрации пользователя ${telegramId}:`,
        error
      );

      // В случае ошибки отправляем инструкции по ручной регистрации
      if (chatId && firstName) {
        await this.sendRegistrationInstructions(chatId, firstName, telegramId);
      }
    }
  }

  private generateTempPassword(): string {
    // Генерируем пароль из 12 символов: буквы + цифры
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async sendRegistrationSuccessMessage(
    chatId: number,
    firstName: string,
    telegramId: string,
    password: string
  ): Promise<void> {
    const message = `Привет, ${firstName}! 🎉\n\nВы успешно зарегистрированы в BotManager!\n\n🔐 Ваши учетные данные:\n• Telegram ID: \`${telegramId}\`\n• Временный пароль: \`${password}\`\n\n⚠️ **Важно:** Рекомендуем сразу изменить пароль после первого входа!\n\n🔗 Веб-интерфейс: ${this.configService.get("app.frontendUrl")}\n\nТеперь вы можете создавать и управлять Telegram ботами! 🤖`;

    this.logger.log(`📤 Отправка данных регистрации пользователю ${chatId}`);
    await this.sendMessage(chatId, message, { parse_mode: "Markdown" });
  }

  private async sendRegistrationInstructions(
    chatId: number,
    firstName: string,
    telegramId: string
  ): Promise<void> {
    const message = `Привет, ${firstName}! 👋\n\nДобро пожаловать в BotManager! 🚀\n\nДля начала работы с нашим сервисом вам необходимо зарегистрироваться.\n\n📋 Ваш Telegram ID: \`${telegramId}\`\n\n🔗 Перейдите по ссылке для регистрации:\n${this.configService.get("app.frontendUrl")}/register\n\n📝 Инструкция по регистрации:\n1. Откройте ссылку выше\n2. Введите ваш Telegram ID: \`${telegramId}\`\n3. Заполните остальные поля\n4. Подтвердите регистрацию кодом, который мы отправим\n\nПосле регистрации вы сможете создавать и управлять Telegram ботами! 🤖`;

    this.logger.log(`📤 Отправка инструкций пользователю ${chatId}`);
    await this.sendMessage(chatId, message, { parse_mode: "Markdown" });
  }

  private async sendMessage(
    chatId: number,
    text: string,
    options?: { parse_mode?: "HTML" | "Markdown" | "MarkdownV2" }
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn(
        `⚠️ Нет токена для отправки сообщения chatId: ${chatId}`
      );
      return false;
    }

    try {
      const url = `${this.getBotApiUrl()}/sendMessage`;
      this.logger.debug(`🌐 POST ${url}`);

      const response = await axios.post(url, {
        chat_id: chatId,
        text,
        ...options,
      });

      if (response.data.ok) {
        this.logger.log(`✅ Сообщение отправлено chatId: ${chatId}`);
        return true;
      } else {
        this.logger.error(
          `❌ Ошибка отправки chatId ${chatId}: ${response.data.description}`
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `❌ Исключение при отправке chatId ${chatId}: ${error.message}`,
        error.stack
      );
      if (error.response) {
        this.logger.error(
          `📄 Telegram API ответ: ${JSON.stringify(error.response.data)}`
        );
      }
      return false;
    }
  }

  // Метод для установки webhook (вызывается при запуске приложения)
  async setupWebhook(): Promise<void> {
    if (!this.botToken) {
      this.logger.warn("TELEGRAM_BOT_TOKEN не установлен");
      throw new Error("TELEGRAM_BOT_TOKEN не установлен");
    }

    try {
      const webhookUrl = `${this.configService.get("app.webhookBaseUrl")}/assistant-bot/webhook`;
      const url = `${this.getBotApiUrl()}/setWebhook`;

      this.logger.log(`🔧 Установка webhook: ${webhookUrl}`);

      const response = await axios.post(url, {
        url: webhookUrl,
        allowed_updates: ["message"],
      });

      if (response.data.ok) {
        this.logger.log("✅ Webhook установлен успешно");

        // Получаем информацию о webhook для проверки
        const webhookInfo = await this.getWebhookInfo();
        this.logger.log(`📊 Webhook info: ${JSON.stringify(webhookInfo)}`);
      } else {
        this.logger.error(
          `❌ Ошибка установки webhook: ${response.data.description}`
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Исключение при установке webhook: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async getWebhookInfo(): Promise<any> {
    if (!this.botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN не установлен");
    }

    try {
      const url = `${this.getBotApiUrl()}/getWebhookInfo`;
      const response = await axios.get(url);

      if (response.data.ok) {
        return response.data.result;
      } else {
        throw new Error(`Ошибка getWebhookInfo: ${response.data.description}`);
      }
    } catch (error) {
      this.logger.error(`Ошибка getWebhookInfo: ${error.message}`);
      throw error;
    }
  }

  async deleteWebhook(): Promise<void> {
    if (!this.botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN не установлен");
    }

    try {
      const url = `${this.getBotApiUrl()}/deleteWebhook`;
      const response = await axios.post(url);

      if (response.data.ok) {
        this.logger.log("✅ Webhook удален");
      } else {
        this.logger.error(
          `❌ Ошибка удаления webhook: ${response.data.description}`
        );
      }
    } catch (error) {
      this.logger.error(`❌ Исключение при удалении webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить токен бота-ассистента
   */
  getBotToken(): string {
    return this.botToken;
  }

  /**
   * Обработка админ-команд
   */
  private async handleAdminCommand(
    text: string,
    telegramId: string,
    chatId: number,
    from: TelegramUpdate["message"]["from"]
  ): Promise<void> {
    try {
      // Парсим команду и аргументы
      const parts = text.trim().split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      const response = await this.adminTelegramService.handleCommand({
        command,
        args,
        telegramId,
        chatId,
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
      });

      await this.sendMessage(chatId, response, { parse_mode: "Markdown" });
    } catch (error) {
      this.logger.error(
        `Ошибка обработки админ-команды от ${telegramId}:`,
        error
      );
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`, {
        parse_mode: "Markdown",
      });
    }
  }
}
