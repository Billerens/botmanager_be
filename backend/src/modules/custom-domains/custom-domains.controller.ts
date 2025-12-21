import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard, Public } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../../database/entities/user.entity";
import { CustomDomainsService } from "./services/custom-domains.service";
import { CreateDomainDto, DomainResponseDto } from "./dto/custom-domain.dto";

@ApiTags("Custom Domains")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("custom-domains")
export class CustomDomainsController {
  constructor(private readonly domainsService: CustomDomainsService) {}

  /**
   * Публичный endpoint для проверки домена (используется Caddy on-demand TLS)
   * Caddy делает запрос: GET /api/custom-domains/verify-domain?domain=shop.example.com
   * Ответ 200 = домен разрешён, 404 = запрещён
   */
  @Get("verify-domain")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Проверить домен для on-demand TLS (используется Caddy)",
  })
  @ApiResponse({ status: 200, description: "Домен разрешён" })
  @ApiResponse({ status: 404, description: "Домен не найден или не активен" })
  async verifyDomainForTls(
    @Query("domain") domain: string
  ): Promise<{ allowed: boolean }> {
    const isAllowed = await this.domainsService.isDomainAllowedForTls(domain);
    if (!isAllowed) {
      throw new NotFoundException("Domain not allowed");
    }
    return { allowed: true };
  }

  @Get()
  @ApiOperation({ summary: "Получить все домены пользователя" })
  @ApiResponse({ status: 200, type: [DomainResponseDto] })
  async getAll(@CurrentUser() user: User): Promise<DomainResponseDto[]> {
    return this.domainsService.getUserDomains(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить домен по ID" })
  @ApiResponse({ status: 200, type: DomainResponseDto })
  @ApiResponse({ status: 404, description: "Домен не найден" })
  async getOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User
  ): Promise<DomainResponseDto> {
    return this.domainsService.getDomainById(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: "Добавить новый кастомный домен" })
  @ApiResponse({ status: 201, type: DomainResponseDto })
  @ApiResponse({ status: 400, description: "Некорректные данные" })
  @ApiResponse({ status: 409, description: "Домен уже существует" })
  async create(
    @Body() dto: CreateDomainDto,
    @CurrentUser() user: User
  ): Promise<DomainResponseDto> {
    return this.domainsService.createDomain(dto, user);
  }

  @Post(":id/check-dns")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Проверить настройку DNS" })
  @ApiResponse({ status: 200, type: DomainResponseDto })
  @ApiResponse({ status: 400, description: "Rate limit или неверный статус" })
  @ApiResponse({ status: 404, description: "Домен не найден" })
  async checkDns(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User
  ): Promise<DomainResponseDto> {
    return this.domainsService.requestDnsCheck(id, user.id);
  }

  @Post(":id/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Подтвердить владение доменом" })
  @ApiResponse({ status: 200, type: DomainResponseDto })
  @ApiResponse({ status: 400, description: "DNS не настроен или rate limit" })
  @ApiResponse({ status: 404, description: "Домен не найден" })
  async verifyOwnership(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User
  ): Promise<DomainResponseDto> {
    return this.domainsService.requestOwnershipVerification(id, user.id);
  }

  @Post(":id/reactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Повторно активировать приостановленный домен" })
  @ApiResponse({ status: 200, type: DomainResponseDto })
  @ApiResponse({ status: 400, description: "Домен не приостановлен" })
  @ApiResponse({ status: 404, description: "Домен не найден" })
  async reactivate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User
  ): Promise<DomainResponseDto> {
    return this.domainsService.reactivateDomain(id, user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить домен" })
  @ApiResponse({ status: 204, description: "Домен удалён" })
  @ApiResponse({ status: 404, description: "Домен не найден" })
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User
  ): Promise<void> {
    return this.domainsService.deleteDomain(id, user.id);
  }
}
