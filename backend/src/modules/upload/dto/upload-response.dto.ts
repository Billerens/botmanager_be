import { ApiProperty } from "@nestjs/swagger";

export class UploadResponseDto {
  @ApiProperty({
    description: "URL загруженного файла",
    example: "https://example.com/uploads/image.jpg",
  })
  url: string;

  @ApiProperty({
    description: "Имя файла",
    example: "image.jpg",
  })
  filename: string;

  @ApiProperty({
    description: "Размер файла в байтах",
    example: 1024000,
  })
  size: number;

  @ApiProperty({
    description: "MIME тип файла",
    example: "image/jpeg",
  })
  mimeType: string;

  @ApiProperty({
    description: "Дата загрузки",
    example: "2024-01-15T10:30:00.000Z",
  })
  uploadedAt: Date;
}
