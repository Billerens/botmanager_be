import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "../../../database/entities/user.entity";

export class ErrorResponseDto {
  @ApiProperty({
    description: "Статус ошибки",
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение об ошибке",
    example: "User not found",
  })
  message: string;

  @ApiProperty({
    description: "Код ошибки",
    example: "USER_NOT_FOUND",
    required: false,
  })
  errorCode?: string;

  @ApiProperty({
    description: "Дополнительные детали ошибки",
    example: {
      timestamp: "2024-01-15T10:30:00.000Z",
      userId: "123e4567-e89b-12d3-a456-426614174000",
    },
    required: false,
  })
  details?: Record<string, any>;
}

export class UpdateRoleResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "User role updated successfully",
  })
  message: string;

  @ApiProperty({
    description: "ID пользователя",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "Новая роль пользователя",
    example: "ADMIN",
  })
  newRole: string;

  @ApiProperty({
    description: "Предыдущая роль",
    example: "MANAGER",
  })
  previousRole: string;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class ToggleActiveResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "User status toggled successfully",
  })
  message: string;

  @ApiProperty({
    description: "ID пользователя",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "Новый статус активности",
    example: false,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Предыдущий статус",
    example: true,
  })
  previousStatus: boolean;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class DeleteResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "User deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "ID удаленного пользователя",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  deletedId: string;

  @ApiProperty({
    description: "Дата удаления",
    example: "2024-01-15T10:30:00.000Z",
  })
  deletedAt: Date;
}

export { UserResponseDto } from "../../auth/dto/auth-response.dto";

export class UserStatsResponseDto {
  @ApiProperty({
    description: "Общее количество пользователей",
    example: 1000,
  })
  totalUsers: number;

  @ApiProperty({
    description: "Количество активных пользователей",
    example: 850,
  })
  activeUsers: number;

  @ApiProperty({
    description: "Количество новых пользователей за последние 30 дней",
    example: 150,
  })
  newUsersLast30Days: number;

  @ApiProperty({
    description: "Количество пользователей с верифицированным Telegram",
    example: 800,
  })
  verifiedUsers: number;

  @ApiProperty({
    description: "Количество пользователей с включенной 2FA",
    example: 200,
  })
  twoFactorEnabledUsers: number;

  @ApiProperty({
    description: "Распределение по ролям",
    example: {
      owner: 5,
      admin: 20,
      manager: 50,
    },
  })
  usersByRole: Record<UserRole, number>;
}
