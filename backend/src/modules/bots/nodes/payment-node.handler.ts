import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowContext } from "./base-node-handler.interface";
import { PaymentTransactionService } from "../../payments/services/payment-transaction.service";
import { PaymentEntityType } from "../../../database/entities/payment-config.entity";
import { PaymentTargetType, PaymentStatus } from "../../../database/entities/payment.entity";

/**
 * Обработчик узла Payment для Flow
 *
 * Поддерживаемые действия:
 * - create: Создание платежа
 * - check_status: Проверка статуса платежа
 * - cancel: Отмена платежа
 * - refund: Возврат платежа
 */
@Injectable()
export class PaymentNodeHandler extends BaseNodeHandler {
  constructor(
    @InjectRepository(BotFlow)
    botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService,
    @Inject(forwardRef(() => PaymentTransactionService))
    private readonly paymentTransactionService: PaymentTransactionService
  ) {
    super(
      botFlowRepository,
      botFlowNodeRepository,
      telegramService,
      botsService,
      logger,
      messagesService,
      activityLogService
    );
  }

  canHandle(nodeType: string): boolean {
    return nodeType === "payment";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot, message } = context;
    const nodeData = currentNode?.data?.payment;

    if (!nodeData) {
      this.logger.error("Payment node data not found");
      await this.handleNodeError(context, new Error("Payment node data not configured"));
      return;
    }

    const action = nodeData.action;
    this.logger.log(`Executing payment node, action: ${action}`);

    try {
      switch (action) {
        case "create":
          await this.handleCreatePayment(context, nodeData);
          break;
        case "check_status":
          await this.handleCheckStatus(context, nodeData);
          break;
        case "cancel":
          await this.handleCancelPayment(context, nodeData);
          break;
        case "refund":
          await this.handleRefundPayment(context, nodeData);
          break;
        default:
          this.logger.error(`Unknown payment action: ${action}`);
          await this.handleNodeError(context, new Error(`Unknown payment action: ${action}`));
          return;
      }

      // Логирование
      if (bot.ownerId) {
        await this.activityLogService.create({
          type: ActivityType.BOT_ACTION,
          level: ActivityLevel.INFO,
          message: `Payment action executed: ${action}`,
          userId: bot.ownerId,
          botId: bot.id,
          metadata: {
            action,
            nodeId: currentNode.nodeId,
            chatId: message.chat?.id,
          },
        });
      }

      // Переход к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    } catch (error: any) {
      this.logger.error(`Payment node error: ${error.message}`, error.stack);

      // Сохраняем ошибку в переменные сессии
      session.variables = session.variables || {};
      session.variables.payment_error = error.message;
      session.variables.payment_error_code = error.code || "UNKNOWN_ERROR";

      // Логируем ошибку
      if (bot.ownerId) {
        await this.activityLogService.create({
          type: ActivityType.BOT_ERROR,
          level: ActivityLevel.ERROR,
          message: `Payment error: ${error.message}`,
          userId: bot.ownerId,
          botId: bot.id,
          metadata: {
            action,
            nodeId: currentNode.nodeId,
            chatId: message.chat?.id,
            error: error.message,
          },
        });
      }

      // Отправляем сообщение об ошибке пользователю
      const errorMessage = this.getErrorMessage(error);
      if (message.chat?.id) {
        await this.sendAndSaveMessage(bot, message.chat.id, errorMessage);
      }

      // Всё равно переходим к следующему узлу (можно проверить payment_error в condition узле)
      await this.moveToNextNode(context, currentNode.nodeId, "error");
    }
  }

  /**
   * Создание платежа
   */
  private async handleCreatePayment(
    context: FlowContext,
    nodeData: any
  ): Promise<void> {
    const { session, bot, message } = context;

    // Получаем значения с подстановкой переменных
    const amount = this.parseAmount(
      this.substituteVariables(nodeData.amount || "0", context)
    );
    const currency = nodeData.currency || "RUB";
    const description =
      this.substituteVariables(nodeData.description || "", context) ||
      "Оплата через бота";
    const returnUrl = this.substituteVariables(
      nodeData.returnUrl || "",
      context
    );
    const cancelUrl = this.substituteVariables(
      nodeData.cancelUrl || "",
      context
    );

    if (amount <= 0) {
      throw new Error("Сумма платежа должна быть больше 0");
    }

    // Создаём платёж
    const payment = await this.paymentTransactionService.createPayment({
      entityType: PaymentEntityType.BOT,
      entityId: bot.id,
      targetType: PaymentTargetType.FLOW_PAYMENT,
      targetId: context.currentNode.nodeId,
      provider: nodeData.provider,
      amount,
      currency,
      description,
      customer: {
        telegramUserId: message.from?.id?.toString(),
        telegramUsername: message.from?.username,
        fullName: `${message.from?.first_name || ""} ${message.from?.last_name || ""}`.trim(),
      },
      metadata: {
        flowId: context.flow.id,
        nodeId: context.currentNode.nodeId,
        chatId: message.chat?.id,
        userId: message.from?.id,
      },
      returnUrl: returnUrl || undefined,
      cancelUrl: cancelUrl || undefined,
    });

    // Сохраняем результат в переменные сессии
    session.variables = session.variables || {};

    if (nodeData.resultVariable) {
      session.variables[nodeData.resultVariable] = {
        id: payment.id,
        externalId: payment.externalId,
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
        paymentUrl: payment.paymentUrl,
      };
    }

    if (nodeData.paymentUrlVariable) {
      session.variables[nodeData.paymentUrlVariable] = payment.paymentUrl;
    }

    if (nodeData.statusVariable) {
      session.variables[nodeData.statusVariable] = payment.status;
    }

    // Сохраняем ID платежа для последующих проверок
    session.variables.last_payment_id = payment.id;
    session.variables.last_payment_external_id = payment.externalId;
    session.variables.last_payment_url = payment.paymentUrl;
    session.variables.last_payment_status = payment.status;

    this.logger.log(`Payment created: ${payment.id}, URL: ${payment.paymentUrl}`);

    // Отправляем ссылку на оплату пользователю
    if (message.chat?.id && payment.paymentUrl) {
      const paymentMessage = `💳 Для оплаты перейдите по ссылке:\n${payment.paymentUrl}\n\nСумма: ${amount} ${currency}`;

      await this.sendAndSaveMessage(bot, message.chat.id, paymentMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💳 Оплатить",
                url: payment.paymentUrl,
              },
            ],
          ],
        },
      });
    }
  }

  /**
   * Проверка статуса платежа
   */
  private async handleCheckStatus(
    context: FlowContext,
    nodeData: any
  ): Promise<void> {
    const { session } = context;

    // Получаем ID платежа
    let paymentId: string;

    if (nodeData.paymentIdVariable) {
      const paymentData = session.variables?.[nodeData.paymentIdVariable];
      if (typeof paymentData === "object" && paymentData.id) {
        paymentId = paymentData.id;
      } else {
        paymentId = paymentData as string;
      }
    } else {
      paymentId = session.variables?.last_payment_id;
    }

    if (!paymentId) {
      throw new Error("ID платежа не найден");
    }

    // Проверяем статус
    const payment = await this.paymentTransactionService.checkPaymentStatus(paymentId);

    // Сохраняем результат
    session.variables = session.variables || {};

    if (nodeData.resultVariable) {
      session.variables[nodeData.resultVariable] = {
        id: payment.id,
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
        isPaid: payment.status === PaymentStatus.SUCCEEDED,
      };
    }

    if (nodeData.statusVariable) {
      session.variables[nodeData.statusVariable] = payment.status;
    }

    // Обновляем last_payment_status
    session.variables.last_payment_status = payment.status;

    this.logger.log(`Payment status checked: ${payment.id} = ${payment.status}`);
  }

  /**
   * Отмена платежа
   */
  private async handleCancelPayment(
    context: FlowContext,
    nodeData: any
  ): Promise<void> {
    const { session, bot, message } = context;

    // Получаем ID платежа
    let paymentId: string;

    if (nodeData.paymentIdVariable) {
      const paymentData = session.variables?.[nodeData.paymentIdVariable];
      if (typeof paymentData === "object" && paymentData.id) {
        paymentId = paymentData.id;
      } else {
        paymentId = paymentData as string;
      }
    } else {
      paymentId = session.variables?.last_payment_id;
    }

    if (!paymentId) {
      throw new Error("ID платежа не найден");
    }

    // Отменяем платёж
    const payment = await this.paymentTransactionService.cancelPayment(paymentId);

    // Сохраняем результат
    session.variables = session.variables || {};

    if (nodeData.resultVariable) {
      session.variables[nodeData.resultVariable] = {
        id: payment.id,
        status: payment.status,
        canceled: true,
      };
    }

    if (nodeData.statusVariable) {
      session.variables[nodeData.statusVariable] = payment.status;
    }

    session.variables.last_payment_status = payment.status;

    this.logger.log(`Payment canceled: ${payment.id}`);

    // Уведомляем пользователя
    if (message.chat?.id) {
      await this.sendAndSaveMessage(
        bot,
        message.chat.id,
        "❌ Платёж отменён"
      );
    }
  }

  /**
   * Возврат платежа
   */
  private async handleRefundPayment(
    context: FlowContext,
    nodeData: any
  ): Promise<void> {
    const { session, bot, message } = context;

    // Получаем ID платежа
    let paymentId: string;

    if (nodeData.paymentIdVariable) {
      const paymentData = session.variables?.[nodeData.paymentIdVariable];
      if (typeof paymentData === "object" && paymentData.id) {
        paymentId = paymentData.id;
      } else {
        paymentId = paymentData as string;
      }
    } else {
      paymentId = session.variables?.last_payment_id;
    }

    if (!paymentId) {
      throw new Error("ID платежа не найден");
    }

    // Получаем сумму возврата (если указана)
    let refundAmount: number | undefined;
    if (nodeData.refundAmount) {
      refundAmount = this.parseAmount(
        this.substituteVariables(nodeData.refundAmount, context)
      );
    }

    const reason = this.substituteVariables(nodeData.refundReason || "", context);

    // Выполняем возврат
    const payment = await this.paymentTransactionService.refundPayment(
      paymentId,
      refundAmount,
      reason || undefined
    );

    // Сохраняем результат
    session.variables = session.variables || {};

    if (nodeData.resultVariable) {
      session.variables[nodeData.resultVariable] = {
        id: payment.id,
        status: payment.status,
        refunded: true,
        refundAmount: refundAmount || Number(payment.amount),
      };
    }

    if (nodeData.statusVariable) {
      session.variables[nodeData.statusVariable] = payment.status;
    }

    session.variables.last_payment_status = payment.status;

    this.logger.log(`Payment refunded: ${payment.id}`);

    // Уведомляем пользователя
    if (message.chat?.id) {
      const refundMessage = refundAmount
        ? `💰 Выполнен частичный возврат: ${refundAmount} ${payment.currency}`
        : `💰 Выполнен полный возврат платежа`;

      await this.sendAndSaveMessage(bot, message.chat.id, refundMessage);
    }
  }

  /**
   * Парсинг суммы
   */
  private parseAmount(value: string): number {
    if (!value) return 0;

    // Убираем пробелы и заменяем запятые на точки
    const cleaned = value.toString().replace(/\s/g, "").replace(",", ".");
    const amount = parseFloat(cleaned);

    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Получение человекочитаемого сообщения об ошибке
   */
  private getErrorMessage(error: any): string {
    // Можно добавить маппинг кодов ошибок
    const defaultMessage = "Произошла ошибка при обработке платежа. Попробуйте позже.";

    if (error.code === "INVALID_CONFIG") {
      return "⚠️ Платежи не настроены. Обратитесь к администратору.";
    }

    if (error.code === "INVALID_AMOUNT") {
      return "⚠️ Некорректная сумма платежа.";
    }

    if (error.code === "PAYMENT_NOT_FOUND") {
      return "⚠️ Платёж не найден.";
    }

    if (error.message) {
      return `⚠️ ${error.message}`;
    }

    return defaultMessage;
  }
}

