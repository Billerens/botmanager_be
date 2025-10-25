import { ApiProperty } from "@nestjs/swagger";

export class DashboardStatsResponseDto {
  @ApiProperty({
    description: "Общее количество ботов",
    example: 25,
  })
  totalBots: number;

  @ApiProperty({
    description: "Общее количество пользователей",
    example: 1500,
  })
  totalUsers: number;

  @ApiProperty({
    description: "Общее количество сообщений",
    example: 50000,
  })
  totalMessages: number;

  @ApiProperty({
    description: "Общее количество заявок",
    example: 2500,
  })
  totalLeads: number;

  @ApiProperty({
    description: "Активные боты",
    example: 20,
  })
  activeBots: number;

  @ApiProperty({
    description: "Новые пользователи за последние 30 дней",
    example: 150,
  })
  newUsersLast30Days: number;

  @ApiProperty({
    description: "Сообщения за последние 7 дней",
    example: 2500,
  })
  messagesLast7Days: number;

  @ApiProperty({
    description: "Заявки за последние 7 дней",
    example: 125,
  })
  leadsLast7Days: number;
}
