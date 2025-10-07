import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";
import * as winston from "winston";
import LokiTransport from "winston-loki";
import axios from "axios";

@Injectable()
export class CustomLoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: "botmanager-backend" },
      transports: [
        // Консольный вывод
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        // Отправка в Loki (если доступен)
        new LokiTransport({
          host: process.env.LOKI_HOST || "http://localhost:3100",
          labels: {
            job: "botmanager-backend",
            service: "backend",
            environment: process.env.NODE_ENV || "development",
          },
          json: true,
          format: winston.format.json(),
          onConnectionError: (err) =>
            console.error("Loki connection error:", err),
        }),
      ],
    });
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context });
    this.sendToLoki("info", message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
    this.sendToLoki("error", message, context, trace);
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context });
    this.sendToLoki("warn", message, context);
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context });
    this.sendToLoki("debug", message, context);
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(message, { context });
    this.sendToLoki("verbose", message, context);
  }

  private async sendToLoki(
    level: string,
    message: any,
    context?: string,
    trace?: string
  ) {
    try {
      const logEntry = {
        streams: [
          {
            stream: {
              job: "botmanager-backend",
              service: "backend",
              level: level,
              context: context || "default",
            },
            values: [
              [
                (Date.now() * 1000000).toString(), // nanoseconds timestamp
                JSON.stringify({
                  message:
                    typeof message === "string"
                      ? message
                      : JSON.stringify(message),
                  level,
                  context,
                  trace,
                  timestamp: new Date().toISOString(),
                }),
              ],
            ],
          },
        ],
      };

      await axios.post("http://localhost:3100/loki/api/v1/push", logEntry, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 1000,
      });
    } catch (error) {
      // Игнорируем ошибки отправки в Loki
    }
  }
}
