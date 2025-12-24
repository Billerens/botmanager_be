import { SubdomainStatus } from "../enums/domain-status.enum";

/**
 * Данные статуса субдомена (ответ API)
 *
 * Используется для отображения информации о субдомене пользователю,
 * включая время до следующего редеплоя для активации SSL.
 */
export interface SubdomainStatusData {
  /** Slug субдомена (например: "myshop") */
  slug: string | null;

  /** Текущий статус */
  status: SubdomainStatus | null;

  /** Полный URL субдомена (если активен) */
  url: string | null;

  /** Сообщение об ошибке (если есть) */
  error: string | null;

  /** Дата активации субдомена */
  activatedAt: Date | null;

  /** Сообщение о примерном времени ожидания */
  estimatedWaitMessage: string | null;

  /**
   * Время следующего планового редеплоя фронтенда (ISO string)
   *
   * Для новых субдоменов SSL-сертификат активируется после редеплоя.
   * null если планировщик неактивен.
   */
  nextRedeployAt: string | null;

  /**
   * Секунды до следующего редеплоя
   *
   * Используется для показа обратного отсчёта на UI.
   * null если планировщик неактивен.
   */
  secondsUntilRedeploy: number | null;

  /**
   * Интервал редеплоя в часах (для информирования пользователя)
   */
  redeployIntervalHours: number | null;
}

/**
 * Вспомогательные функции для формирования статуса
 */
export class SubdomainStatusHelper {
  /**
   * Сформировать сообщение об ожидании с учётом редеплоя
   */
  static getEstimatedWaitMessage(
    status: SubdomainStatus | null,
    secondsUntilRedeploy: number | null
  ): string | null {
    if (
      status !== SubdomainStatus.PENDING &&
      status !== SubdomainStatus.DNS_CREATING &&
      status !== SubdomainStatus.ACTIVATING
    ) {
      return null;
    }

    if (secondsUntilRedeploy === null) {
      return "Субдомен активируется. Время ожидания может варьироваться.";
    }

    const hours = Math.floor(secondsUntilRedeploy / 3600);
    const minutes = Math.floor((secondsUntilRedeploy % 3600) / 60);

    if (hours > 0) {
      return `SSL-сертификат будет активирован примерно через ${hours} ч ${minutes} мин после планового обновления сервиса.`;
    } else if (minutes > 5) {
      return `SSL-сертификат будет активирован примерно через ${minutes} мин после планового обновления сервиса.`;
    } else {
      return "SSL-сертификат скоро будет активирован (плановое обновление сервиса вот-вот начнётся).";
    }
  }

  /**
   * Форматирование времени для отображения пользователю
   */
  static formatTimeUntilRedeploy(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `~${hours} ч ${minutes} мин`;
    }
    return `~${minutes} мин`;
  }
}

