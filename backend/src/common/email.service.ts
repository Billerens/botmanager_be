import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT");
    const user = this.configService.get<string>("SMTP_USER");
    const password = this.configService.get<string>("SMTP_PASSWORD");
    const from = this.configService.get<string>("SMTP_FROM");

    if (!host || !port || !user || !password) {
      this.logger.warn(
        "SMTP настройки не полностью заданы. Email отправка будет недоступна."
      );
      this.logger.warn(
        `Проверьте переменные окружения: SMTP_HOST=${host}, SMTP_PORT=${port}, SMTP_USER=${user}`
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true для 465, false для других портов
      auth: {
        user,
        pass: password,
      },
      // Специальные настройки для Gmail
      tls: {
        rejectUnauthorized: false, // Для Gmail может потребоваться
        ciphers: "SSLv3", // Совместимость с Gmail
      },
      // Улучшенные таймауты для Gmail
      connectionTimeout: 10000, // 10 секунд на подключение (увеличено для Gmail)
      greetingTimeout: 5000, // 5 секунд на приветствие
      socketTimeout: 10000, // 10 секунд на операции с сокетом
      // Дополнительные настройки для лучшей диагностики
      debug: process.env.NODE_ENV === "development", // Включаем debug в dev режиме
      logger: process.env.NODE_ENV === "development", // Логируем в dev режиме
    });

    this.logger.log(`Email сервис инициализирован: ${host}:${port}`);

    // Проверяем соединение при инициализации
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        "Transporter не инициализирован, пропускаем проверку соединения"
      );
      return;
    }

    try {
      this.logger.log("Проверка соединения с SMTP сервером...");
      await this.transporter.verify();
      this.logger.log("✅ SMTP соединение успешно установлено");
    } catch (error) {
      this.logger.error("❌ Ошибка проверки SMTP соединения:", error);
      this.logger.error("SMTP сервер недоступен или неправильно настроен");
      this.logger.error(
        "Проверьте настройки SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD"
      );
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`=== ОТПРАВКА EMAIL ВЕРИФИКАЦИИ ===`);
    this.logger.log(`Email: ${email}`);
    this.logger.log(`Код: ${code}`);

    // Проверяем, что transporter инициализирован
    if (!this.transporter) {
      const error = new Error(
        "SMTP transporter не инициализирован. Проверьте настройки SMTP."
      );
      this.logger.error(error.message);
      throw error;
    }

    // Получаем настройки для диагностики
    const host = this.configService.get<string>("SMTP_HOST");
    const from =
      this.configService.get<string>("SMTP_FROM") ||
      this.configService.get<string>("SMTP_USER");

    const mailOptions = {
      from: from,
      to: email,
      subject: "Подтверждение регистрации - Bot Manager",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 30px;
                border: 1px solid #e0e0e0;
              }
              .code-box {
                background-color: #fff;
                border: 2px solid #4CAF50;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
              }
              .code {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #4CAF50;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #888;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Добро пожаловать в Bot Manager!</h2>
              <p>Спасибо за регистрацию. Для завершения регистрации введите код подтверждения:</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <p>Код действителен в течение <strong>15 минут</strong>.</p>
              
              <p>Если вы не регистрировались в Bot Manager, просто проигнорируйте это письмо.</p>
              
              <div class="footer">
                <p>С уважением,<br>Команда Bot Manager</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Добро пожаловать в Bot Manager!\n\nКод подтверждения: ${code}\n\nКод действителен в течение 15 минут.\n\nЕсли вы не регистрировались в Bot Manager, просто проигнорируйте это письмо.`,
    };

    try {
      this.logger.log(`Подготовка к отправке email через SMTP`);
      const smtpStartTime = Date.now();

      await this.transporter.sendMail(mailOptions);

      const smtpDuration = Date.now() - smtpStartTime;
      const totalDuration = Date.now() - startTime;

      this.logger.log(`Код верификации успешно отправлен на ${email}`);
      this.logger.log(`SMTP время отправки: ${smtpDuration}ms`);
      this.logger.log(`Общее время выполнения: ${totalDuration}ms`);
      this.logger.log(`=== EMAIL ОТПРАВЛЕН ===`);
    } catch (error) {
      const smtpDuration = Date.now() - startTime;
      this.logger.error(
        `Ошибка при отправке email на ${email} за ${smtpDuration}ms: ${error.message}`,
        error.stack
      );
      this.logger.error(`Детали SMTP ошибки:`, error);

      // Дополнительная диагностика для разных типов ошибок
      if (error.message.includes("Connection timeout")) {
        this.logger.error(
          "🔴 ПРОБЛЕМА: SMTP сервер недоступен или неправильно настроен"
        );
        this.logger.error("Проверьте:");
        this.logger.error("1. SMTP_HOST - правильный ли хост?");
        this.logger.error("2. SMTP_PORT - правильный ли порт?");
        this.logger.error("3. Сетевое соединение с SMTP сервером");
        this.logger.error("4. Firewall не блокирует соединение");

        // Специальные рекомендации для Gmail
        if (host === "smtp.gmail.com") {
          this.logger.error("📧 GMAIL СПЕЦИАЛЬНЫЕ ТРЕБОВАНИЯ:");
          this.logger.error("1. Включите 2FA в Google аккаунте");
          this.logger.error("2. Создайте App Password (не обычный пароль!)");
          this.logger.error("3. Используйте App Password в SMTP_PASSWORD");
          this.logger.error(
            "4. Проверьте, что 'Less secure app access' отключен"
          );
        }
      } else if (error.message.includes("Authentication failed")) {
        this.logger.error("🔴 ПРОБЛЕМА: Неверные учетные данные SMTP");
        this.logger.error("Проверьте SMTP_USER и SMTP_PASSWORD");

        // Специальные рекомендации для Gmail
        if (host === "smtp.gmail.com") {
          this.logger.error("📧 GMAIL АУТЕНТИФИКАЦИЯ:");
          this.logger.error("1. Используйте App Password, а не обычный пароль");
          this.logger.error("2. App Password: 16 символов без пробелов");
          this.logger.error(
            "3. Создайте App Password: Google Account > Security > App passwords"
          );
        }
      } else if (error.message.includes("ECONNREFUSED")) {
        this.logger.error("🔴 ПРОБЛЕМА: Соединение отклонено SMTP сервером");
        this.logger.error("Проверьте доступность SMTP сервера");
      }

      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    if (!this.transporter) {
      this.logger.error(
        `Невозможно отправить email на ${email}: транспортер не инициализирован`
      );
      this.logger.warn(`Токен сброса пароля для ${email}: ${token}`);
      return;
    }

    const from =
      this.configService.get<string>("SMTP_FROM") ||
      this.configService.get<string>("SMTP_USER");

    const resetUrl = `${this.configService.get<string>("FRONTEND_URL")}/reset-password?token=${token}`;

    const mailOptions = {
      from: from,
      to: email,
      subject: "Сброс пароля - Bot Manager",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 30px;
                border: 1px solid #e0e0e0;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background-color: #FF5722;
                color: #fff !important;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #888;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Сброс пароля</h2>
              <p>Вы запросили сброс пароля для вашего аккаунта в Bot Manager.</p>
              
              <p>Нажмите на кнопку ниже, чтобы создать новый пароль:</p>
              
              <a href="${resetUrl}" class="button">Сбросить пароль</a>
              
              <p>Ссылка действительна в течение <strong>1 часа</strong>.</p>
              
              <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
              
              <div class="footer">
                <p>С уважением,<br>Команда Bot Manager</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Сброс пароля\n\nВы запросили сброс пароля для вашего аккаунта в Bot Manager.\n\nПерейдите по ссылке: ${resetUrl}\n\nСсылка действительна в течение 1 часа.\n\nЕсли вы не запрашивали сброс пароля, просто проигнорируйте это письмо.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email сброса пароля отправлен на ${email}`);
    } catch (error) {
      this.logger.error(
        `Ошибка при отправке email на ${email}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
