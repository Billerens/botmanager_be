import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  createParamDecorator,
} from "@nestjs/common";
import { PublicApiKeyService, ApiKeyContext as ApiKeyContextType } from "../public-api-key.service";

/**
 * Guard для проверки публичного API ключа
 * Извлекает ключ из заголовка X-API-Key и валидирует его
 * При успехе добавляет apiKeyContext в request
 */
@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(PublicApiKeyGuard.name);

  constructor(private readonly publicApiKeyService: PublicApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Извлекаем API ключ из заголовка
    const apiKey =
      request.headers["x-api-key"] ||
      request.headers["authorization"]?.replace("Bearer ", "");

    if (!apiKey) {
      throw new ForbiddenException("API ключ не предоставлен");
    }

    // Получаем origin и IP для проверки
    const origin = request.headers["origin"] || request.headers["referer"];
    const ip =
      request.headers["x-forwarded-for"]?.split(",")[0] ||
      request.connection?.remoteAddress ||
      request.ip;

    try {
      // Валидируем ключ и получаем контекст
      const apiKeyContext = await this.publicApiKeyService.validateApiKey(
        apiKey,
        origin,
        ip,
      );

      // Добавляем контекст в request для использования в контроллере
      request.apiKeyContext = apiKeyContext;

      this.logger.debug(
        `API Key validated: owner=${apiKeyContext.ownerId}, type=${apiKeyContext.ownerType}`,
      );

      return true;
    } catch (error) {
      this.logger.warn(`API Key validation failed: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Декоратор для извлечения контекста API ключа из request
 */
export const ApiKeyContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ApiKeyContextType => {
    const request = ctx.switchToHttp().getRequest();
    return request.apiKeyContext;
  },
);
