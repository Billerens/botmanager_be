import * as crypto from "crypto";

// Алгоритм шифрования
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Получение ключа шифрования из переменной окружения
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY не установлен в переменных окружения"
    );
  }
  // Используем SHA-256 для получения 32-байтного ключа
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Шифрование строки
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Формат: iv:authTag:encryptedData (все в hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Расшифровка строки
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Неверный формат зашифрованных данных");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Проверка, является ли строка зашифрованной
 */
export function isEncrypted(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const parts = text.split(":");
  // Проверяем формат: iv(32 hex chars):authTag(32 hex chars):data
  return (
    parts.length === 3 &&
    parts[0].length === IV_LENGTH * 2 &&
    parts[1].length === AUTH_TAG_LENGTH * 2 &&
    /^[0-9a-f]+$/i.test(parts[0]) &&
    /^[0-9a-f]+$/i.test(parts[1])
  );
}

/**
 * Маскирование секретного значения для отображения
 * Показывает только первые и последние 4 символа
 */
export function maskSecret(value: string): string {
  if (!value || value.length <= 8) {
    return "••••••••";
  }
  return `${value.substring(0, 4)}••••${value.substring(value.length - 4)}`;
}

/**
 * Список полей, которые нужно шифровать для каждого провайдера
 */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  yookassa: ["secretKey"],
  tinkoff: ["secretKey"],
  robokassa: ["password1", "password2", "password3", "password4"],
  stripe: ["secretKey", "webhookSecret"],
};

/**
 * Шифрование чувствительных полей в конфигурации провайдера
 */
export function encryptProviderConfig(
  provider: string,
  config: Record<string, any>
): Record<string, any> {
  if (!config) return config;

  const sensitiveFields = SENSITIVE_FIELDS[provider] || [];
  const encryptedConfig = { ...config };

  for (const field of sensitiveFields) {
    if (encryptedConfig[field] && !isEncrypted(encryptedConfig[field])) {
      encryptedConfig[field] = encrypt(encryptedConfig[field]);
    }
  }

  return encryptedConfig;
}

/**
 * Расшифровка чувствительных полей в конфигурации провайдера
 */
export function decryptProviderConfig(
  provider: string,
  config: Record<string, any>
): Record<string, any> {
  if (!config) return config;

  const sensitiveFields = SENSITIVE_FIELDS[provider] || [];
  const decryptedConfig = { ...config };

  for (const field of sensitiveFields) {
    if (decryptedConfig[field] && isEncrypted(decryptedConfig[field])) {
      decryptedConfig[field] = decrypt(decryptedConfig[field]);
    }
  }

  return decryptedConfig;
}

/**
 * Маскирование чувствительных полей для отправки на фронтенд
 * Возвращает объект с маскированными значениями и флагами наличия
 */
export function maskProviderConfig(
  provider: string,
  config: Record<string, any>
): Record<string, any> {
  if (!config) return config;

  const sensitiveFields = SENSITIVE_FIELDS[provider] || [];
  const maskedConfig = { ...config };

  for (const field of sensitiveFields) {
    if (maskedConfig[field]) {
      // Сначала расшифровываем если зашифровано
      let value = maskedConfig[field];
      if (isEncrypted(value)) {
        try {
          value = decrypt(value);
        } catch {
          // Если не удалось расшифровать, маскируем как есть
        }
      }
      // Маскируем значение
      maskedConfig[field] = maskSecret(value);
      // Добавляем флаг, что поле установлено
      maskedConfig[`_${field}Set`] = true;
    }
  }

  return maskedConfig;
}

/**
 * Проверка, является ли значение маскированным (содержит ••••)
 */
export function isMaskedValue(value: string): boolean {
  return value?.includes("••••") || false;
}

/**
 * Объединение новых значений с существующими (для обновления)
 * Если поле маскировано, сохраняем старое значение
 */
export function mergeProviderConfigs(
  provider: string,
  existingConfig: Record<string, any>,
  newConfig: Record<string, any>
): Record<string, any> {
  if (!newConfig) return existingConfig;
  if (!existingConfig) return newConfig;

  const sensitiveFields = SENSITIVE_FIELDS[provider] || [];
  const mergedConfig = { ...newConfig };

  for (const field of sensitiveFields) {
    // Если новое значение маскировано или пустое, сохраняем старое
    if (
      isMaskedValue(mergedConfig[field]) ||
      mergedConfig[field] === "" ||
      mergedConfig[field] === undefined
    ) {
      mergedConfig[field] = existingConfig[field];
    }
    // Удаляем служебные флаги
    delete mergedConfig[`_${field}Set`];
  }

  return mergedConfig;
}
