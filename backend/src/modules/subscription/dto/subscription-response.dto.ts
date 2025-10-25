import { ApiProperty } from "@nestjs/swagger";
import { SubscriptionPlan } from "../../../database/entities/subscription.entity";

export class SubscriptionResponseDto {
  @ApiProperty({
    description: "ID подписки",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "ID пользователя",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "План подписки",
    enum: SubscriptionPlan,
    example: SubscriptionPlan.BUSINESS,
  })
  plan: SubscriptionPlan;

  @ApiProperty({
    description: "Статус подписки",
    example: "active",
  })
  status: string;

  @ApiProperty({
    description: "Дата начала подписки",
    example: "2024-01-01T00:00:00.000Z",
  })
  startDate: Date;

  @ApiProperty({
    description: "Дата окончания подписки",
    example: "2024-02-01T00:00:00.000Z",
  })
  endDate: Date;

  @ApiProperty({
    description: "Автопродление подписки",
    example: true,
  })
  autoRenew: boolean;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}
