import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    // Логирование для диагностики
    this.logger.error(
      `Validation error on ${request.method} ${request.url}`,
    );
    this.logger.error(`Content-Type: ${request.headers["content-type"]}`);
    this.logger.error(`Body: ${JSON.stringify(request.body)}`);
    this.logger.error(`Body keys: ${Object.keys(request.body || {}).join(", ")}`);
    this.logger.error(`Messages in body: ${request.body?.messages !== undefined ? "yes" : "no"}`);
    if (request.body?.messages !== undefined) {
      this.logger.error(`Messages type: ${typeof request.body.messages}`);
      this.logger.error(`Messages is array: ${Array.isArray(request.body.messages)}`);
      this.logger.error(`Messages value: ${JSON.stringify(request.body.messages)}`);
    }
    this.logger.error(`Exception response: ${JSON.stringify(exceptionResponse)}`);

    // Форматируем ответ в формате, который ожидает клиент
    const message = Array.isArray(exceptionResponse.message)
      ? exceptionResponse.message
      : [exceptionResponse.message || "Validation failed"];

    // Детальные ошибки валидации (из custom-data и других сервисов)
    const errors = exceptionResponse.errors || null;

    response.status(status).json({
      message,
      error: exceptionResponse.error || "Bad Request",
      statusCode: status,
      // Добавляем детали ошибок валидации если они есть
      ...(errors && { errors }),
    });
  }
}

