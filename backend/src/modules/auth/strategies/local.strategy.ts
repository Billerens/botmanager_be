import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";

import { AuthService } from "../auth.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: "telegramId",
    });
  }

  async validate(telegramId: string, password: string) {
    const user = await this.authService.validateUser(telegramId, password);
    if (!user) {
      throw new UnauthorizedException("Неверные учетные данные");
    }
    return user;
  }
}
