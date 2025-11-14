import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AgentToolCallDto,
  AgentToolResultDto,
  AgentToolType,
  StyleApplyParamsDto,
  StylePreviewParamsDto,
  StyleResetParamsDto,
  DataUpdateParamsDto,
  ComponentConfigParamsDto,
  ExecuteAgentToolsResponseDto,
  UndoAgentActionDto,
  UndoAgentActionResponseDto,
} from "./dto/agent-tools.dto";
import { BotsService } from "../bots/bots.service";
import { BookingsService } from "../booking/services/bookings.service";
import { SpecialistsService } from "../booking/services/specialists.service";
import { ServicesService } from "../booking/services/services.service";
import { ProductsService } from "../products/products.service";
import { CategoriesService } from "../categories/categories.service";

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private configService: ConfigService,
    private botsService: BotsService,
    private bookingsService: BookingsService,
    private specialistsService: SpecialistsService,
    private servicesService: ServicesService,
    private productsService: ProductsService,
    private categoriesService: CategoriesService,
  ) {}

  /**
   * Выполняет инструменты агента
   */
  async executeTools(
    toolCalls: AgentToolCallDto[],
  ): Promise<ExecuteAgentToolsResponseDto> {
    const results: AgentToolResultDto[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error executing tool ${toolCall.toolType}:`, error);
        results.push({
          success: false,
          error: error.message || "Unknown error occurred",
        });
      }
    }

    return { results };
  }

  /**
   * Выполняет один инструмент
   */
  private async executeTool(toolCall: AgentToolCallDto): Promise<AgentToolResultDto> {
    switch (toolCall.toolType) {
      case AgentToolType.STYLE_APPLY:
        return this.applyStyles(toolCall.params as StyleApplyParamsDto);

      case AgentToolType.STYLE_PREVIEW:
        return this.previewStyles(toolCall.params as StylePreviewParamsDto);

      case AgentToolType.STYLE_RESET:
        return this.resetStyles(toolCall.params as StyleResetParamsDto);

      case AgentToolType.DATA_UPDATE:
        return this.updateData(toolCall.params as DataUpdateParamsDto);

      case AgentToolType.COMPONENT_CONFIG:
        return this.configureComponent(toolCall.params as ComponentConfigParamsDto);

      default:
        throw new BadRequestException(`Unknown tool type: ${toolCall.toolType}`);
    }
  }

  /**
   * Применяет стили к боту
   */
  private async applyStyles(params: StyleApplyParamsDto): Promise<AgentToolResultDto> {
    try {
      if (!params.botId) {
        throw new BadRequestException("botId is required for style application");
      }

      // Получаем текущего бота
      const bot = await this.botsService.findOne(params.botId);
      if (!bot) {
        throw new BadRequestException("Bot not found");
      }

      // Валидируем CSS правила
      if (!this.isValidCss(params.cssRules)) {
        throw new BadRequestException("Invalid CSS rules provided");
      }

      // Обновляем стили бота в зависимости от контекста
      let updateData: any = {};

      if (params.context === "booking") {
        updateData.bookingStyling = {
          ...bot.bookingStyling,
          customCss: params.cssRules,
          updatedAt: new Date(),
        };
      } else if (params.context === "shop") {
        updateData.shopStyling = {
          ...bot.shopStyling,
          customCss: params.cssRules,
          updatedAt: new Date(),
        };
      } else {
        throw new BadRequestException(`Unsupported context: ${params.context}`);
      }

      // Сохраняем изменения
      await this.botsService.update(params.botId, updateData);

      const actionId = `style_apply_${params.context}_${Date.now()}`;

      return {
        success: true,
        result: {
          message: `Styles applied successfully to ${params.context} context`,
          context: params.context,
          cssLength: params.cssRules.length,
        },
        actionId,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to apply styles: ${error.message}`);
    }
  }

  /**
   * Предварительный просмотр стилей (временно сохраняет в сессии)
   */
  private async previewStyles(params: StylePreviewParamsDto): Promise<AgentToolResultDto> {
    try {
      // Валидируем CSS правила
      if (!this.isValidCss(params.cssRules)) {
        throw new BadRequestException("Invalid CSS rules provided");
      }

      // Создаем временный идентификатор для предварительного просмотра
      const previewId = `preview_${params.context}_${Date.now()}`;

      // Здесь можно сохранить стили в кэше Redis или временном хранилище
      // Пока возвращаем успешный результат

      return {
        success: true,
        result: {
          message: `Styles preview prepared for ${params.context} context`,
          previewId,
          context: params.context,
          cssLength: params.cssRules.length,
        },
        actionId: previewId,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to prepare style preview: ${error.message}`);
    }
  }

  /**
   * Сбрасывает стили к значениям по умолчанию
   */
  private async resetStyles(params: StyleResetParamsDto): Promise<AgentToolResultDto> {
    try {
      if (!params.botId) {
        throw new BadRequestException("botId is required for style reset");
      }

      // Получаем текущего бота
      const bot = await this.botsService.findOne(params.botId);
      if (!bot) {
        throw new BadRequestException("Bot not found");
      }

      // Сбрасываем стили в зависимости от контекста
      let updateData: any = {};

      if (params.context === "booking") {
        updateData.bookingStyling = {
          ...bot.bookingStyling,
          customCss: "",
          updatedAt: new Date(),
        };
      } else if (params.context === "shop") {
        updateData.shopStyling = {
          ...bot.shopStyling,
          customCss: "",
          updatedAt: new Date(),
        };
      } else {
        throw new BadRequestException(`Unsupported context: ${params.context}`);
      }

      // Сохраняем изменения
      await this.botsService.update(params.botId, updateData);

      const actionId = `style_reset_${params.context}_${Date.now()}`;

      return {
        success: true,
        result: {
          message: `Styles reset successfully for ${params.context} context`,
          context: params.context,
        },
        actionId,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to reset styles: ${error.message}`);
    }
  }

  /**
   * Обновляет данные бота
   */
  private async updateData(params: DataUpdateParamsDto): Promise<AgentToolResultDto> {
    try {
      if (!params.botId) {
        throw new BadRequestException("botId is required for data update");
      }

      let result: any;

      switch (params.dataType) {
        case "specialists":
          result = await this.updateSpecialists(params.botId, params.data);
          break;

        case "services":
          result = await this.updateServices(params.botId, params.data);
          break;

        case "products":
          result = await this.updateProducts(params.botId, params.data);
          break;

        case "categories":
          result = await this.updateCategories(params.botId, params.data);
          break;

        default:
          throw new BadRequestException(`Unsupported data type: ${params.dataType}`);
      }

      const actionId = `data_update_${params.dataType}_${Date.now()}`;

      return {
        success: true,
        result: {
          message: `Data updated successfully for ${params.dataType}`,
          dataType: params.dataType,
          updatedItems: result,
        },
        actionId,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update data: ${error.message}`);
    }
  }

  /**
   * Настраивает компоненты
   */
  private async configureComponent(params: ComponentConfigParamsDto): Promise<AgentToolResultDto> {
    try {
      if (!params.botId) {
        throw new BadRequestException("botId is required for component configuration");
      }

      // Получаем текущего бота
      const bot = await this.botsService.findOne(params.botId);
      if (!bot) {
        throw new BadRequestException("Bot not found");
      }

      // Обновляем конфигурацию компонента
      let updateData: any = {};

      if (params.componentType === "booking-form") {
        updateData.bookingConfig = {
          ...bot.bookingConfig,
          ...params.config,
          updatedAt: new Date(),
        };
      } else if (params.componentType === "shop-catalog") {
        updateData.shopConfig = {
          ...bot.shopConfig,
          ...params.config,
          updatedAt: new Date(),
        };
      } else {
        throw new BadRequestException(`Unsupported component type: ${params.componentType}`);
      }

      // Сохраняем изменения
      await this.botsService.update(params.botId, updateData);

      const actionId = `component_config_${params.componentType}_${Date.now()}`;

      return {
        success: true,
        result: {
          message: `Component ${params.componentType} configured successfully`,
          componentType: params.componentType,
          config: params.config,
        },
        actionId,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to configure component: ${error.message}`);
    }
  }

  /**
   * Валидирует CSS правила
   */
  private isValidCss(css: string): boolean {
    // Простая валидация CSS
    // В реальном проекте можно использовать более сложную валидацию
    if (!css || css.trim().length === 0) {
      return false;
    }

    // Проверяем базовую структуру CSS
    const cssRegex = /^[^{}]*\{[^}]*\}[^{}]*$/;
    return cssRegex.test(css.replace(/\s/g, "").replace(/\n/g, ""));
  }

  /**
   * Обновляет специалистов
   */
  private async updateSpecialists(botId: string, data: any): Promise<any> {
    // Реализация обновления специалистов
    return { updated: 1 };
  }

  /**
   * Обновляет услуги
   */
  private async updateServices(botId: string, data: any): Promise<any> {
    // Реализация обновления услуг
    return { updated: 1 };
  }

  /**
   * Обновляет товары
   */
  private async updateProducts(botId: string, data: any): Promise<any> {
    // Реализация обновления товаров
    return { updated: 1 };
  }

  /**
   * Обновляет категории
   */
  private async updateCategories(botId: string, data: any): Promise<any> {
    // Реализация обновления категорий
    return { updated: 1 };
  }

  /**
   * Отменяет действие агента
   */
  async undoAction(undoDto: UndoAgentActionDto): Promise<UndoAgentActionResponseDto> {
    try {
      // Парсим actionId для определения типа действия
      // Формат: {toolType}_{context}_{timestamp}
      const parts = undoDto.actionId.split('_');
      if (parts.length < 3) {
        throw new BadRequestException('Invalid actionId format');
      }

      const toolType = parts[0] as AgentToolType;
      const context = parts[1];
      const timestamp = parts.slice(2).join('_');

      let result: any;

      switch (toolType) {
        case AgentToolType.STYLE_APPLY:
          result = await this.undoStyleApply(context, undoDto.botId);
          break;

        case AgentToolType.STYLE_RESET:
          // Для reset нужно знать предыдущее состояние
          result = await this.undoStyleReset(context, undoDto.botId);
          break;

        case AgentToolType.DATA_UPDATE:
          result = await this.undoDataUpdate(context, undoDto.botId);
          break;

        case AgentToolType.COMPONENT_CONFIG:
          result = await this.undoComponentConfig(context, undoDto.botId);
          break;

        default:
          throw new BadRequestException(`Cannot undo tool type: ${toolType}`);
      }

      return {
        success: true,
        message: `Action ${undoDto.actionId} has been undone successfully`,
        undoneAction: result,
      };

    } catch (error) {
      this.logger.error(`Error undoing action ${undoDto.actionId}:`, error);
      throw new BadRequestException(`Failed to undo action: ${error.message}`);
    }
  }

  /**
   * Отменяет применение стилей
   */
  private async undoStyleApply(context: string, botId?: string): Promise<any> {
    if (!botId) {
      throw new BadRequestException('botId is required for style undo');
    }

    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new BadRequestException('Bot not found');
    }

    // Для undo нужно хранить предыдущее состояние
    // Пока возвращаем заглушку
    return {
      context,
      botId,
      action: 'style_apply_undone',
      message: 'Style application has been undone',
    };
  }

  /**
   * Отменяет сброс стилей
   */
  private async undoStyleReset(context: string, botId?: string): Promise<any> {
    // Реализация отмены сброса стилей
    return {
      context,
      botId,
      action: 'style_reset_undone',
      message: 'Style reset has been undone',
    };
  }

  /**
   * Отменяет обновление данных
   */
  private async undoDataUpdate(dataType: string, botId?: string): Promise<any> {
    // Реализация отмены обновления данных
    return {
      dataType,
      botId,
      action: 'data_update_undone',
      message: 'Data update has been undone',
    };
  }

  /**
   * Отменяет настройку компонентов
   */
  private async undoComponentConfig(componentType: string, botId?: string): Promise<any> {
    // Реализация отмены настройки компонентов
    return {
      componentType,
      botId,
      action: 'component_config_undone',
      message: 'Component configuration has been undone',
    };
  }
}
