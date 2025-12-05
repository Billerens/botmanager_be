import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import { Resend } from "resend";

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

type EmailProvider = "resend" | "smtp" | "none";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;
  private provider: EmailProvider = "none";
  private fromEmail: string = "";

  constructor(private readonly configService: ConfigService) {
    this.initializeProvider();
  }

  /**
   * Инициализация провайдера email (Resend приоритетнее SMTP)
   */
  private initializeProvider(): void {
    // Сначала пробуем Resend (работает через HTTP, обходит блокировку портов)
    const resendApiKey = this.configService.get<string>("RESEND_API_KEY");
    if (resendApiKey) {
      this.initializeResend(resendApiKey);
      return;
    }

    // Если Resend не настроен - пробуем SMTP
    this.initializeSmtp();
  }

  /**
   * Инициализация Resend (HTTP API)
   */
  private initializeResend(apiKey: string): void {
    try {
      this.resend = new Resend(apiKey);
      this.fromEmail =
        this.configService.get<string>("RESEND_FROM") ||
        "onboarding@resend.dev";
      this.provider = "resend";
      this.logger.log(
        `✅ Email сервис инициализирован: Resend (from: ${this.fromEmail})`
      );
    } catch (error) {
      this.logger.error("Ошибка инициализации Resend:", error);
    }
  }

  /**
   * Инициализация SMTP (fallback)
   */
  private initializeSmtp(): void {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT") || 587;
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");
    const secure = port === 465;

    this.logger.log(
      `SMTP конфигурация: host=${host}, port=${port}, user=${user ? user.substring(0, 3) + "***" : "не задан"}, secure=${secure}`
    );

    if (!host || !user || !pass) {
      this.logger.warn(
        "Email сервис не настроен: отсутствуют RESEND_API_KEY или SMTP настройки"
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false,
        },
      });

      this.fromEmail = this.configService.get<string>("SMTP_FROM") || user;
      this.provider = "smtp";
      this.logger.log(`✅ Email сервис инициализирован: SMTP ${host}:${port}`);

      // Проверяем соединение (неблокирующе)
      this.verifySmtpConnection();
    } catch (error) {
      this.logger.error("Ошибка инициализации SMTP:", error);
    }
  }

  /**
   * Проверяет SMTP соединение
   */
  private async verifySmtpConnection(): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log("✅ SMTP соединение проверено успешно");
    } catch (error: any) {
      this.logger.error(`❌ Ошибка SMTP: ${error?.message}`);
      this.logger.warn(
        "SMTP недоступен. Рекомендуем использовать Resend (RESEND_API_KEY)"
      );
      // Отключаем SMTP если не работает
      this.provider = "none";
      this.transporter = null;
    }
  }

  /**
   * Проверяет, настроен ли email сервис
   */
  isEnabled(): boolean {
    return this.provider !== "none";
  }

  /**
   * Возвращает текущий провайдер
   */
  getProvider(): EmailProvider {
    return this.provider;
  }

  /**
   * Отправляет email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `Email не отправлен (сервис не настроен): ${options.to} - ${options.subject}`
      );
      return false;
    }

    const startTime = Date.now();
    this.logger.debug(
      `Отправка email на ${options.to} через ${this.provider}...`
    );

    try {
      if (this.provider === "resend") {
        return await this.sendViaResend(options, startTime);
      } else {
        return await this.sendViaSmtp(options, startTime);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Ошибка отправки email на ${options.to} (${duration}ms): ${error?.message || error}`
      );
      return false;
    }
  }

  /**
   * Отправка через Resend API
   */
  private async sendViaResend(
    options: EmailOptions,
    startTime: number
  ): Promise<boolean> {
    const { data, error } = await this.resend!.emails.send({
      from: this.fromEmail,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    const duration = Date.now() - startTime;

    if (error) {
      this.logger.error(`Resend ошибка: ${error.message} (${duration}ms)`);
      return false;
    }

    this.logger.log(
      `✅ Email отправлен через Resend: ${options.to} (id: ${data?.id}, ${duration}ms)`
    );
    return true;
  }

  /**
   * Отправка через SMTP
   */
  private async sendViaSmtp(
    options: EmailOptions,
    startTime: number
  ): Promise<boolean> {
    const info = await this.transporter!.sendMail({
      from: this.fromEmail,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    const duration = Date.now() - startTime;
    this.logger.log(
      `✅ Email отправлен через SMTP: ${options.to} (messageId: ${info.messageId}, ${duration}ms)`
    );
    return true;
  }

  /**
   * Отправляет код верификации email
   */
  async sendVerificationCode(
    to: string,
    code: string,
    botName?: string
  ): Promise<boolean> {
    const subject = botName
      ? `Код подтверждения для ${botName}`
      : "Код подтверждения email";

    const html = this.getVerificationEmailTemplate(code, botName);
    const text = `Ваш код подтверждения: ${code}\n\nКод действителен 15 минут.`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Отправляет код для сброса пароля
   */
  async sendPasswordResetCode(
    to: string,
    code: string,
    botName?: string
  ): Promise<boolean> {
    const subject = botName ? `Сброс пароля для ${botName}` : "Сброс пароля";

    const html = this.getPasswordResetEmailTemplate(code, botName);
    const text = `Код для сброса пароля: ${code}\n\nКод действителен 15 минут.\n\nЕсли вы не запрашивали сброс пароля, проигнорируйте это письмо.`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Шаблон письма с кодом верификации
   */
  private getVerificationEmailTemplate(code: string, botName?: string): string {
    const title = botName
      ? `Подтверждение email для ${botName}`
      : "Подтверждение email";

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 30px;">
              <h1 style="margin: 0 0 20px; color: #1a1a2e; font-size: 24px; font-weight: 600; text-align: center;">
                ${title}
              </h1>
              <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.5; text-align: center;">
                Используйте код ниже для подтверждения вашего email адреса:
              </p>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
                <span style="font-size: 32px; font-weight: bold; color: #ffffff; letter-spacing: 8px;">
                  ${code}
                </span>
              </div>
              <p style="margin: 0; color: #999999; font-size: 14px; text-align: center;">
                Код действителен <strong>15 минут</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center; border-top: 1px solid #eeeeee; padding-top: 20px;">
                Если вы не запрашивали этот код, просто проигнорируйте это письмо.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Шаблон письма для сброса пароля
   */
  private getPasswordResetEmailTemplate(
    code: string,
    botName?: string
  ): string {
    const title = botName ? `Сброс пароля для ${botName}` : "Сброс пароля";

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 30px;">
              <h1 style="margin: 0 0 20px; color: #1a1a2e; font-size: 24px; font-weight: 600; text-align: center;">
                ${title}
              </h1>
              <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.5; text-align: center;">
                Вы запросили сброс пароля. Используйте код ниже:
              </p>
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
                <span style="font-size: 32px; font-weight: bold; color: #ffffff; letter-spacing: 8px;">
                  ${code}
                </span>
              </div>
              <p style="margin: 0; color: #999999; font-size: 14px; text-align: center;">
                Код действителен <strong>15 минут</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center; border-top: 1px solid #eeeeee; padding-top: 20px;">
                Если вы не запрашивали сброс пароля, проигнорируйте это письмо. Ваш пароль останется без изменений.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Отправляет уведомление о новом заказе
   */
  async sendOrderConfirmation(
    to: string,
    orderId: string,
    orderTotal: number,
    currency: string,
    botName?: string
  ): Promise<boolean> {
    const subject = botName
      ? `Заказ #${orderId.slice(-6)} подтверждён - ${botName}`
      : `Заказ #${orderId.slice(-6)} подтверждён`;

    const html = this.getOrderConfirmationTemplate(
      orderId,
      orderTotal,
      currency,
      botName
    );
    const text = `Ваш заказ #${orderId.slice(-6)} успешно создан.\nСумма: ${orderTotal} ${currency}`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Шаблон письма подтверждения заказа
   */
  private getOrderConfirmationTemplate(
    orderId: string,
    orderTotal: number,
    currency: string,
    botName?: string
  ): string {
    const title = "Заказ подтверждён";

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 30px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; width: 60px; height: 60px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 50%; line-height: 60px; font-size: 28px;">
                  ✓
                </span>
              </div>
              <h1 style="margin: 0 0 20px; color: #1a1a2e; font-size: 24px; font-weight: 600; text-align: center;">
                ${title}
              </h1>
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5; text-align: center;">
                Спасибо за заказ${botName ? ` в ${botName}` : ""}!
              </p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                  <strong>Номер заказа:</strong> #${orderId.slice(-6).toUpperCase()}
                </p>
                <p style="margin: 0; color: #666666; font-size: 14px;">
                  <strong>Сумма:</strong> ${orderTotal} ${currency}
                </p>
              </div>
              <p style="margin: 0; color: #999999; font-size: 14px; text-align: center;">
                Мы свяжемся с вами для уточнения деталей доставки.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Отправляет уведомление о бронировании
   */
  async sendBookingConfirmation(
    to: string,
    bookingId: string,
    serviceName: string,
    dateTime: string,
    botName?: string
  ): Promise<boolean> {
    const subject = botName
      ? `Бронирование подтверждено - ${botName}`
      : "Бронирование подтверждено";

    const html = this.getBookingConfirmationTemplate(
      bookingId,
      serviceName,
      dateTime,
      botName
    );
    const text = `Ваше бронирование #${bookingId.slice(-6)} подтверждено.\nУслуга: ${serviceName}\nДата и время: ${dateTime}`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Шаблон письма подтверждения бронирования
   */
  private getBookingConfirmationTemplate(
    bookingId: string,
    serviceName: string,
    dateTime: string,
    botName?: string
  ): string {
    const title = "Бронирование подтверждено";

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 30px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; line-height: 60px; font-size: 28px;">
                  📅
                </span>
              </div>
              <h1 style="margin: 0 0 20px; color: #1a1a2e; font-size: 24px; font-weight: 600; text-align: center;">
                ${title}
              </h1>
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5; text-align: center;">
                Ваше бронирование${botName ? ` в ${botName}` : ""} успешно подтверждено!
              </p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                  <strong>Номер брони:</strong> #${bookingId.slice(-6).toUpperCase()}
                </p>
                <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                  <strong>Услуга:</strong> ${serviceName}
                </p>
                <p style="margin: 0; color: #666666; font-size: 14px;">
                  <strong>Дата и время:</strong> ${dateTime}
                </p>
              </div>
              <p style="margin: 0; color: #999999; font-size: 14px; text-align: center;">
                Ждём вас!
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
