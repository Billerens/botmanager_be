import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT");
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");

    if (!host || !user || !pass) {
      this.logger.warn(
        "Email сервис не настроен: отсутствуют SMTP_HOST, SMTP_USER или SMTP_PASS в переменных окружения"
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465, // true для 465, false для других портов
        auth: {
          user,
          pass,
        },
        // Таймауты для предотвращения зависания
        connectionTimeout: 5000, // 5 секунд на подключение
        greetingTimeout: 5000, // 5 секунд на приветствие
        socketTimeout: 10000, // 10 секунд на операции с сокетом
      });

      this.isConfigured = true;
      this.logger.log(`Email сервис инициализирован: ${host}:${port || 587}`);

      // Проверяем соединение при старте (неблокирующе)
      this.verifyConnection();
    } catch (error) {
      this.logger.error("Ошибка инициализации email транспорта:", error);
    }
  }

  /**
   * Проверяет соединение с SMTP сервером (неблокирующе)
   */
  private async verifyConnection(): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log("SMTP соединение проверено успешно");
    } catch (error) {
      this.logger.error("Ошибка проверки SMTP соединения:", error);
      // Не отключаем сервис - возможно проблема временная
    }
  }

  /**
   * Проверяет, настроен ли email сервис
   */
  isEnabled(): boolean {
    return this.isConfigured && this.transporter !== null;
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

    const from =
      this.configService.get<string>("SMTP_FROM") ||
      this.configService.get<string>("SMTP_USER");

    this.logger.debug(`Отправка email на ${options.to}...`);
    const startTime = Date.now();

    try {
      const info = await this.transporter!.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Email отправлен: ${options.to} (messageId: ${info.messageId}, время: ${duration}ms)`
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Ошибка отправки email на ${options.to} (время: ${duration}ms): ${error?.message || error}`
      );
      return false;
    }
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
