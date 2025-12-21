import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "../../../database/entities/user.entity";

/**
 * Декоратор для получения текущего аутентифицированного пользователя
 * 
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * async getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Если указано конкретное поле, возвращаем его
    if (data) {
      return user?.[data];
    }

    return user;
  },
);

