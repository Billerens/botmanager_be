import { IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateBotSessionVariablesDto {
  @ApiProperty({
    description: "Переменные сессии",
    type: "object",
    example: {
      name: "Иван",
      completed: "true",
    },
  })
  @IsObject()
  variables: Record<string, any>;
}

export class BotSessionResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  chatId: string;

  @ApiProperty()
  botId: string;

  @ApiProperty()
  currentNodeId?: string;

  @ApiProperty()
  variables: Record<string, any>;

  @ApiProperty()
  lastActivity: Date;

  @ApiProperty({ type: Object, required: false })
  user?: {
    id: string;
    telegramId: string;
    telegramUsername?: string;
    firstName?: string;
    lastName?: string;
  };
}
