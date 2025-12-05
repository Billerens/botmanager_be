import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PublicAuthService, PublicUserJwtPayload } from "../public-auth.service";

/**
 * Guard для защиты эндпоинтов, требующих авторизации публичного пользователя
 */
@Injectable()
export class PublicUserGuard implements CanActivate {
  private readonly logger = new Logger(PublicUserGuard.name);

  constructor(
    private jwtService: JwtService,
    private publicAuthService: PublicAuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Извлекаем токен из заголовка Authorization
    const authHeader = request.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Токен авторизации не предоставлен");
    }

    const token = authHeader.substring(7);

    try {
      // Верифицируем JWT токен
      const payload = this.jwtService.verify<PublicUserJwtPayload>(token);

      // Проверяем, что это токен публичного пользователя
      if (payload.type !== "public") {
        throw new UnauthorizedException("Неверный тип токена");
      }

      // Получаем пользователя
      const user = await this.publicAuthService.validateJwtPayload(payload);
      if (!user) {
        throw new UnauthorizedException("Пользователь не найден");
      }

      // Сохраняем пользователя в request для использования в контроллерах
      request.publicUser = user;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error("Ошибка валидации токена:", error);
      throw new UnauthorizedException("Недействительный токен");
    }
  }
}

