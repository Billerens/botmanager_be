/**
 * Результат проверки DNS
 */
export interface DnsCheckResult {
  domain: string;
  timestamp: Date;
  isValid: boolean;
  recordType: "CNAME" | "A" | null;
  records: string[];
  errors: DnsError[];
  instructions: DnsInstruction[];
}

export interface DnsError {
  code: string;
  message: string;
}

export interface DnsInstruction {
  action: string;
  recordType?: string;
  name?: string;
  value?: string;
  ttl?: number;
  current?: string;
  expected?: string;
  message?: string;
}

/**
 * Результат проверки владения
 */
export interface OwnershipCheckResult {
  valid: boolean;
  method?: "dns_txt" | "http_file";
  errors?: DnsError[];
}

/**
 * Результат проверки CNAME
 */
export interface CnameResult {
  found: boolean;
  records: string[];
  pointsToUs: boolean;
}

/**
 * Результат проверки A-записи
 */
export interface ARecordResult {
  found: boolean;
  records: string[];
  pointsToUs: boolean;
}

/**
 * Результат проверки TXT записи
 */
export interface TxtCheckResult {
  valid: boolean;
  records: string[];
  errors: DnsError[];
}

/**
 * Результат проверки HTTP файла
 */
export interface HttpCheckResult {
  valid: boolean;
  errors: DnsError[];
}

/**
 * Информация о SSL сертификате
 */
export interface SslCertificateInfo {
  issuedAt: Date;
  expiresAt: Date;
  issuer: string;
  subject: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  isValid: boolean;
}

