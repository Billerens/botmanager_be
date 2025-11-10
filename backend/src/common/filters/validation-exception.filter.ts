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
      {
        body: request.body,
        query: request.query,
        params: request.params,
        exceptionResponse,
      }
    );

    // Форматируем ответ в формате, который ожидает клиент
    const message = Array.isArray(exceptionResponse.message)
      ? exceptionResponse.message
      : [exceptionResponse.message || "Validation failed"];

    response.status(status).json({
      message,
      error: exceptionResponse.error || "Bad Request",
      statusCode: status,
    });
  }
}

