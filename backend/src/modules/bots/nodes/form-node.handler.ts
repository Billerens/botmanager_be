import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";
import { ActivityLogService } from "../../activity-log/activity-log.service";

@Injectable()
export class FormNodeHandler extends BaseNodeHandler {
  constructor(
    @InjectRepository(BotFlow)
    protected readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    protected readonly botFlowNodeRepository: Repository<BotFlowNode>,
    protected readonly telegramService: TelegramService,
    protected readonly botsService: BotsService,
    protected readonly logger: CustomLoggerService,
    protected readonly messagesService: MessagesService,
    protected readonly activityLogService: ActivityLogService
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
    return nodeType === "form";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, session, message } = context;

    if (!currentNode?.data?.form) {
      this.logger.warn("Данные формы не найдены");
      return;
    }

    const formData = currentNode.data.form;
    const formFields = formData.fields || [];

    this.logger.log(
      `Form нода выполняется. Поля формы: ${JSON.stringify(formFields.map((f) => ({ id: f.id, label: f.label, required: f.required })))}`
    );

    // Инициализируем состояние формы в сессии, если его нет
    if (!session.variables[`form_${currentNode.nodeId}_current_field`]) {
      session.variables[`form_${currentNode.nodeId}_current_field`] = "0";
      session.variables[`form_${currentNode.nodeId}_total_fields`] =
        formFields.length.toString();
      session.variables[`form_${currentNode.nodeId}_completed`] = "false";
      this.logger.log(
        `Инициализировано состояние формы для узла ${currentNode.nodeId}`
      );
    }

    const currentFieldIndex = parseInt(
      session.variables[`form_${currentNode.nodeId}_current_field`] || "0"
    );
    const isFormCompleted =
      session.variables[`form_${currentNode.nodeId}_completed`] === "true";

    // Если узел был достигнут через переход от другого узла
    if (context.reachedThroughTransition) {
      if (formData.resetOnEntry) {
        this.logger.log(`Сброс состояния формы ${currentNode.nodeId} при входе`);
        this.resetFormState(context);
        await this.showCurrentField(context, 0);
      } else {
        this.logger.log(
          `Форма ${currentNode.nodeId} достигнута через переход. Показываем текущее состояние.`
        );
        if (isFormCompleted) {
          await this.showFormCompletion(context);
        } else {
          await this.showCurrentField(context, currentFieldIndex);
        }
      }
      return;
    }

    // Проверяем корректность индекса
    if (currentFieldIndex >= formFields.length && !isFormCompleted) {
      this.logger.warn(
        `Индекс поля ${currentFieldIndex} >= количества полей ${formFields.length}. Принудительно завершаем форму.`
      );
      session.variables[`form_${currentNode.nodeId}_completed`] = "true";
      await this.showFormCompletion(context);
      return;
    }

    // Проверяем завершение формы ДО обработки ввода
    if (isFormCompleted) {
      this.logger.log(
        `Форма ${currentNode.nodeId} уже завершена, обрабатываем как сабмит или переход`
      );
      if (message.is_callback && message.callback_query?.data === `form_submit_${currentNode.nodeId}`) {
        await this.handleFormSubmit(context, currentFieldIndex, true);
      } else {
        await this.moveToNextNode(context, currentNode.nodeId);
      }
      return;
    }

    // Если это callback от кнопки отправки формы
    if (
      message.is_callback &&
      message.callback_query?.data === `form_submit_${currentNode.nodeId}`
    ) {
      await this.handleFormSubmit(context, currentFieldIndex, false);
      return;
    }

    // Если это текстовое сообщение или медиа (ответ пользователя на поле)
    if (!message.is_callback && (message.text || message.photo || message.document || message.video || message.audio || message.voice)) {
      await this.handleFieldInput(context, currentFieldIndex);
      return;
    }

    // Если форма уже завершена, переходим к следующему узлу
    if (isFormCompleted) {
      this.logger.log(
        `Форма ${currentNode.nodeId} уже завершена, переходим к следующему узлу`
      );
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    // Показываем текущее поле для заполнения
    await this.showCurrentField(context, currentFieldIndex);
  }

  private async showCurrentField(
    context: FlowContext,
    currentFieldIndex: number
  ): Promise<void> {
    const { currentNode, bot, session } = context;
    const formData = currentNode.data.form;
    const formFields = formData.fields || [];

    const currentField = formFields[currentFieldIndex];

    if (!currentField) {
      this.logger.warn(
        `Поле с индексом ${currentFieldIndex} не найдено. Пытаемся завершить или перейти.`
      );
      if (currentFieldIndex >= formFields.length) {
        await this.showFormCompletion(context);
      } else {
        await this.moveToNextNode(context, currentNode.nodeId);
      }
      return;
    }

    this.logger.log(
      `Показываем поле: ${currentField.label} (${currentField.type})`
    );

    // Формируем сообщение для текущего поля
    let fieldMessage = `📝 **${currentField.label}**`;

    if (currentField.required) {
      fieldMessage += " * (обязательное)";
    }

    if (currentField.placeholder) {
      fieldMessage += `\n\n💡 ${currentField.placeholder}`;
    }

    // Добавляем инструкции в зависимости от типа поля
    switch (currentField.type) {
      case "email":
        fieldMessage += "\n\n📧 Введите email адрес";
        break;
      case "phone":
        fieldMessage += "\n\n📞 Введите номер телефона";
        break;
      case "number":
        fieldMessage += "\n\n🔢 Введите число";
        break;
      case "date":
        fieldMessage += "\n\n📅 Введите дату в формате ДД.ММ.ГГГГ";
        break;
      case "select":
        if (currentField.options && currentField.options.length > 0) {
          fieldMessage += "\n\n📋 Выберите один из вариантов:\n";
          currentField.options.forEach((option, index) => {
            fieldMessage += `${index + 1}. ${option}\n`;
          });
        }
        break;
      case "multiselect":
        if (currentField.options && currentField.options.length > 0) {
          fieldMessage +=
            "\n\n📋 Выберите несколько вариантов (через запятую):\n";
          currentField.options.forEach((option, index) => {
            fieldMessage += `${index + 1}. ${option}\n`;
          });
        }
        break;
      case "image":
        fieldMessage += "\n\n🖼 Пожалуйста, отправьте изображение";
        break;
    }

    // Показываем прогресс заполнения
    const totalFields = parseInt(
      session.variables[`form_${currentNode.nodeId}_total_fields`] || "0"
    );
    const progress = `${currentFieldIndex + 1}/${totalFields}`;
    fieldMessage += `\n\n📊 Прогресс: ${progress}`;

    await this.sendAndSaveMessage(bot, session.chatId, fieldMessage);
  }

  private async handleFieldInput(
    context: FlowContext,
    currentFieldIndex: number
  ): Promise<void> {
    const { currentNode, bot, session, message } = context;
    const formData = currentNode.data.form;
    const formFields = formData.fields || [];

    const currentField = formFields[currentFieldIndex];

    if (!currentField) {
      this.logger.warn(
        `Поле с индексом ${currentFieldIndex} не найдено при обработке ввода. Переходим к завершению.`
      );
      await this.showFormCompletion(context);
      return;
    }

    let userInput = "";
    if (currentField.type === "image") {
      // Пытаемся получить file_id из разных типов медиа
      if (message.photo && message.photo.length > 0) {
        userInput = message.photo[message.photo.length - 1].file_id;
      } else if (message.document && message.document.mime_type?.startsWith("image/")) {
        userInput = message.document.file_id;
      } else {
        await this.sendAndSaveMessage(
          bot,
          session.chatId,
          "❌ Пожалуйста, отправьте именно изображение."
        );
        return;
      }
    } else {
      userInput = (message.text || "").trim();
    }

    this.logger.log(
      `Пользователь ввел: "${currentField.type === "image" ? "[IMAGE]" : userInput}" для поля ${currentField.label}`
    );

    // Валидация введенных данных
    const validationResult = this.validateFieldInput(currentField, userInput, message);

    if (!validationResult.isValid) {
      await this.sendAndSaveMessage(
        bot,
        session.chatId,
        `❌ ${validationResult.error}\n\nПопробуйте еще раз:`
      );
      return;
    }

    // Сохраняем данные поля в переменную сессии
    const fieldVariableName = `form_${currentNode.nodeId}_${currentField.id}`;
    session.variables[fieldVariableName] = userInput;
    context.inputConsumed = true;

    this.logger.log(`Сохранено значение поля ${currentField.id}: ${userInput}`);

    // Обновляем индекс текущего поля
    const nextFieldIndex = currentFieldIndex + 1;
    session.variables[`form_${currentNode.nodeId}_current_field`] =
      nextFieldIndex.toString();

    // Проверяем, завершена ли форма
    const totalFields = parseInt(
      session.variables[`form_${currentNode.nodeId}_total_fields`] || "0"
    );
    if (nextFieldIndex >= totalFields) {
      session.variables[`form_${currentNode.nodeId}_completed`] = "true";
      this.logger.log(`=== ФОРМА ЗАВЕРШЕНА ===`);
      await this.showFormCompletion(context);
    } else {
      // Показываем следующее поле
      await this.showCurrentField(context, nextFieldIndex);
    }
  }

  private validateFieldInput(
    field: any,
    input: string,
    message: any
  ): { isValid: boolean; error?: string } {
    // Проверка обязательности
    if (field.required && (!input || input.trim() === "")) {
      // Для типа image проверяем наличие медиа
      if (field.type === "image" && !message.photo && !message.document) {
        return {
          isValid: false,
          error: `Поле "${field.label}" обязательно. Пожалуйста, отправьте изображение.`,
        };
      }
      
      return {
        isValid: false,
        error: `Поле "${field.label}" обязательно для заполнения`,
      };
    }

    // Если поле не обязательное и пустое, пропускаем валидацию
    if (!field.required && (!input || input.trim() === "")) {
      return { isValid: true };
    }

    // Валидация по типу поля
    switch (field.type) {
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input)) {
          return { isValid: false, error: "Введите корректный email адрес" };
        }
        break;

      case "phone":
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(input)) {
          return { isValid: false, error: "Введите корректный номер телефона" };
        }
        break;

      case "number":
        const number = parseFloat(input);
        if (isNaN(number)) {
          return { isValid: false, error: "Введите корректное число" };
        }

        if (field.validation) {
          if (
            field.validation.min !== undefined &&
            number < field.validation.min
          ) {
            return {
              isValid: false,
              error: `Число должно быть не менее ${field.validation.min}`,
            };
          }
          if (
            field.validation.max !== undefined &&
            number > field.validation.max
          ) {
            return {
              isValid: false,
              error: `Число должно быть не более ${field.validation.max}`,
            };
          }
        }
        break;

      case "date":
        const dateRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
        if (!dateRegex.test(input)) {
          return { isValid: false, error: "Введите дату в формате ДД.ММ.ГГГГ" };
        }
        break;

      case "select":
        if (field.options && field.options.length > 0) {
          const selectedIndex = parseInt(input) - 1;
          if (
            isNaN(selectedIndex) ||
            selectedIndex < 0 ||
            selectedIndex >= field.options.length
          ) {
            return {
              isValid: false,
              error: `Выберите число от 1 до ${field.options.length}`,
            };
          }
        }
        break;

      case "multiselect":
        if (field.options && field.options.length > 0) {
          const selectedIndices = input
            .split(",")
            .map((s) => parseInt(s.trim()) - 1);
          for (const index of selectedIndices) {
            if (isNaN(index) || index < 0 || index >= field.options.length) {
              return {
                isValid: false,
                error: `Выберите числа от 1 до ${field.options.length}, разделенные запятыми`,
              };
            }
          }
        }
        break;

      case "text":
        if (field.validation) {
          if (
            field.validation.min !== undefined &&
            input.length < field.validation.min
          ) {
            return {
              isValid: false,
              error: `Текст должен содержать не менее ${field.validation.min} символов`,
            };
          }
          if (
            field.validation.max !== undefined &&
            input.length > field.validation.max
          ) {
            return {
              isValid: false,
              error: `Текст должен содержать не более ${field.validation.max} символов`,
            };
          }
          if (field.validation.pattern) {
            const patternRegex = new RegExp(field.validation.pattern);
            if (!patternRegex.test(input)) {
              return {
                isValid: false,
                error: "Текст не соответствует требуемому формату",
              };
            }
          }
        }
        break;
      case "image":
        if (field.required && !input) {
          return { isValid: false, error: "Пожалуйста, отправьте изображение" };
        }
        break;
    }

    return { isValid: true };
  }

  private async showFormCompletion(context: FlowContext): Promise<void> {
    const { currentNode, bot, session } = context;
    const formData = currentNode.data.form;

    this.logger.log(`Форма ${currentNode.nodeId} завершена!`);

    // Показываем сообщение об успешном завершении
    const successMessage =
      formData.successMessage || "✅ Форма успешно заполнена!";
    await this.sendAndSaveMessage(bot, session.chatId, successMessage);

    // Показываем сводку заполненных данных
    const summaryMessage = "📋 **Заполненные данные:**\n\n";
    let summary = summaryMessage;

    for (const field of formData.fields) {
      const fieldValue =
        session.variables[`form_${currentNode.nodeId}_${field.id}`];
      if (fieldValue) {
        summary += `**${field.label}:** ${field.type === 'image' ? '[Изображение сохранено]' : fieldValue}\n`;
      }
    }

    await this.sendAndSaveMessage(bot, session.chatId, summary);

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }

  private async handleFormSubmit(
    context: FlowContext,
    currentFieldIndex: number,
    isFormCompleted: boolean
  ): Promise<void> {
    const { currentNode } = context;

    this.logger.log(`Обработка отправки формы ${currentNode.nodeId}`);

    if (isFormCompleted) {
      // Форма уже завершена, переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    } else {
      // Показываем текущее поле для заполнения
      await this.showCurrentField(context, currentFieldIndex);
    }
  }

  /**
   * Сбрасывает состояние формы в сессии
   */
  private resetFormState(context: FlowContext): void {
    const { currentNode, session } = context;
    const formData = currentNode.data.form;
    const formFields = formData.fields || [];

    // Сбрасываем индекс и флаг завершения
    session.variables[`form_${currentNode.nodeId}_current_field`] = "0";
    session.variables[`form_${currentNode.nodeId}_total_fields`] =
      formFields.length.toString();
    session.variables[`form_${currentNode.nodeId}_completed`] = "false";

    // Очищаем ответы
    for (const field of formFields) {
      delete session.variables[`form_${currentNode.nodeId}_${field.id}`];
    }
  }
}
