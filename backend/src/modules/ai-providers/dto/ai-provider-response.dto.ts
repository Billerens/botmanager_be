import { AiProviderType } from "../../../database/entities/ai-provider.entity";

/**
 * DTO ответа провайдера.
 * ВАЖНО: поле apiKey никогда не возвращается клиенту —
 * только флаг hasApiKey (true/false).
 */
export class AiProviderResponseDto {
  id: string;
  name: string;
  providerType: AiProviderType;
  description: string | null;
  baseUrl: string | null;
  defaultModel: string | null;
  isActive: boolean;
  hasApiKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}
