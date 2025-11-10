import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers } = request;

    // Логируем только для cloud-ai эндпоинтов
    if (url.includes("/api/v1/cloud-ai/v1/chat/completions")) {
      this.logger.debug(`[${method}] ${url}`);
      this.logger.debug(`Content-Type: ${headers["content-type"]}`);
      this.logger.debug(`Body: ${JSON.stringify(body)}`);
      this.logger.debug(`Body type: ${typeof body}`);
      if (body && body.messages !== undefined) {
        this.logger.debug(`Messages type: ${typeof body.messages}`);
        this.logger.debug(`Messages is array: ${Array.isArray(body.messages)}`);
        this.logger.debug(`Messages: ${JSON.stringify(body.messages)}`);
      } else {
        this.logger.warn(`Messages field is missing or undefined in body`);
      }
    }

    return next.handle();
  }
}

