import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as dns from "dns/promises";
import axios from "axios";
import {
  DnsCheckResult,
  OwnershipCheckResult,
  CnameResult,
  ARecordResult,
  TxtCheckResult,
  HttpCheckResult,
  SslCertificateInfo,
} from "../interfaces/dns-check.interface";
import * as tls from "tls";

@Injectable()
export class DnsValidatorService {
  private readonly logger = new Logger(DnsValidatorService.name);

  /** Ожидаемый IP адрес фронтенд-сервера (для A-записей) */
  private readonly EXPECTED_IP: string;

  constructor(private readonly configService: ConfigService) {
    // IP-адрес фронтенд-сервера, на который должны указывать кастомные домены
    this.EXPECTED_IP = this.configService.get<string>("FRONTEND_IP") || "";
  }

  /**
   * Полная проверка DNS для домена
   */
  async validateDns(domain: string): Promise<DnsCheckResult> {
    const result: DnsCheckResult = {
      domain,
      timestamp: new Date(),
      isValid: false,
      recordType: null,
      records: [],
      errors: [],
      instructions: [],
    };

    try {
      // Проверяем A-запись (основной метод для кастомных доменов)
      const aResult = await this.checkARecord(domain);

      if (aResult.found) {
        result.recordType = "A";
        result.records = aResult.records;

        if (aResult.pointsToUs) {
          result.isValid = true;
          this.logger.log(`DNS valid for ${domain}: A → ${aResult.records.join(", ")}`);
        } else {
          result.errors.push({
            code: "A_RECORD_WRONG_IP",
            message: `A-запись указывает на ${aResult.records.join(", ")}, а должна на ${this.EXPECTED_IP}`,
          });
          result.instructions.push({
            action: "UPDATE_A_RECORD",
            current: aResult.records.join(", "),
            expected: this.EXPECTED_IP,
          });
        }
        return result;
      }

      // Ничего не найдено
      result.errors.push({
        code: "NO_DNS_RECORDS",
        message:
          "A-запись не найдена. Возможно, DNS изменения ещё не распространились (это может занять до 48 часов, обычно 5-30 минут).",
      });

      result.instructions.push({
        action: "ADD_A_RECORD",
        recordType: "A",
        name: "@",
        value: this.EXPECTED_IP,
        ttl: 3600,
      });
    } catch (error) {
      this.logger.error(`DNS check failed for ${domain}`, error);
      result.errors.push({
        code: "DNS_LOOKUP_FAILED",
        message: `Не удалось проверить DNS: ${error.message}`,
      });
    }

    return result;
  }

  /**
   * Проверка владения доменом
   */
  async checkOwnership(
    domain: string,
    expectedToken: string
  ): Promise<OwnershipCheckResult> {
    // Сначала пробуем TXT запись
    const txtResult = await this.checkTxtRecord(domain, expectedToken);
    if (txtResult.valid) {
      this.logger.log(`Ownership verified for ${domain} via DNS TXT`);
      return { valid: true, method: "dns_txt" };
    }

    // Fallback: HTTP файл
    const httpResult = await this.checkHttpFile(domain, expectedToken);
    if (httpResult.valid) {
      this.logger.log(`Ownership verified for ${domain} via HTTP file`);
      return { valid: true, method: "http_file" };
    }

    return {
      valid: false,
      errors: [...txtResult.errors, ...httpResult.errors],
    };
  }

  /**
   * Получение информации о SSL сертификате
   */
  async getSslCertificateInfo(domain: string): Promise<SslCertificateInfo | null> {
    return new Promise((resolve) => {
      const socket = tls.connect(
        443,
        domain,
        {
          servername: domain,
          rejectUnauthorized: false, // Получаем даже невалидный сертификат
        },
        () => {
          const cert = socket.getPeerCertificate();
          socket.destroy();

          if (!cert || !cert.valid_to) {
            resolve(null);
            return;
          }

          const expiresAt = new Date(cert.valid_to);
          const issuedAt = new Date(cert.valid_from);
          const now = new Date();
          const daysUntilExpiry = Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          resolve({
            issuedAt,
            expiresAt,
            issuer: cert.issuer?.O || "Unknown",
            subject: cert.subject?.CN || domain,
            daysUntilExpiry,
            isExpired: now > expiresAt,
            isValid: now >= issuedAt && now <= expiresAt,
          });
        }
      );

      socket.on("error", (error) => {
        this.logger.warn(`SSL check failed for ${domain}: ${error.message}`);
        resolve(null);
      });

      socket.setTimeout(10000, () => {
        socket.destroy();
        resolve(null);
      });
    });
  }

  /**
   * Проверка A-записи
   */
  private async checkARecord(domain: string): Promise<ARecordResult> {
    try {
      const records = await dns.resolve4(domain);
      return {
        found: true,
        records,
        pointsToUs: records.some((ip) => ip === this.EXPECTED_IP),
      };
    } catch (error) {
      if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
        return { found: false, records: [], pointsToUs: false };
      }
      throw error;
    }
  }

  /**
   * Проверка TXT записи для верификации
   */
  private async checkTxtRecord(
    domain: string,
    expectedToken: string
  ): Promise<TxtCheckResult> {
    try {
      const records = await dns.resolveTxt(`_botmanager-verify.${domain}`);
      const flatRecords = records.flat();

      if (flatRecords.includes(expectedToken)) {
        return { valid: true, records: flatRecords, errors: [] };
      }

      return {
        valid: false,
        records: flatRecords,
        errors: [
          {
            code: "TXT_TOKEN_MISMATCH",
            message: "TXT-запись найдена, но токен не совпадает",
          },
        ],
      };
    } catch (error) {
      return {
        valid: false,
        records: [],
        errors: [
          {
            code: "TXT_NOT_FOUND",
            message: "TXT-запись для верификации не найдена",
          },
        ],
      };
    }
  }

  /**
   * Проверка HTTP файла для верификации
   */
  private async checkHttpFile(
    domain: string,
    expectedToken: string
  ): Promise<HttpCheckResult> {
    try {
      const response = await axios.get(
        `https://${domain}/.well-known/botmanager-verify.txt`,
        {
          timeout: 10000,
          validateStatus: () => true,
          // Игнорируем SSL ошибки (сертификат может быть ещё не выдан)
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }),
        }
      );

      if (response.status === 200 && response.data?.trim() === expectedToken) {
        return { valid: true, errors: [] };
      }

      if (response.status === 404) {
        return {
          valid: false,
          errors: [
            {
              code: "HTTP_FILE_NOT_ACCESSIBLE",
              message: "Файл верификации не найден",
            },
          ],
        };
      }

      return {
        valid: false,
        errors: [
          {
            code: "HTTP_TOKEN_MISMATCH",
            message: "Файл верификации найден, но токен не совпадает",
          },
        ],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            code: "HTTP_FILE_NOT_ACCESSIBLE",
            message: `Не удалось получить файл верификации: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Извлечение субдомена из полного доменного имени
   */
  private extractSubdomain(domain: string): string | null {
    const parts = domain.split(".");
    if (parts.length > 2) {
      return parts.slice(0, -2).join(".");
    }
    return null;
  }
}

