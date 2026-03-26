import * as crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const keyString =
    process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
  return crypto.scryptSync(keyString, "salt", 32);
}

/**
 * Шифрует строку (токен, API-ключ и т.п.) через AES-256-CBC.
 * Алгоритм идентичен BotsService.encryptToken().
 */
export function encryptSecret(value: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Расшифровывает строку, зашифрованную через encryptSecret() или BotsService.encryptToken().
 */
export function decryptSecret(encryptedValue: string): string {
  const key = getKey();
  const parts = encryptedValue.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
