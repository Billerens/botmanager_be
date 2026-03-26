import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AiProvidersService } from "./ai-providers.service";
import { CreateAiProviderDto } from "./dto/create-ai-provider.dto";
import { UpdateAiProviderDto } from "./dto/update-ai-provider.dto";

@Controller("ai-providers")
@UseGuards(JwtAuthGuard)
export class AiProvidersController {
  constructor(private readonly aiProvidersService: AiProvidersService) {}

  @Get()
  findAll(@Request() req) {
    return this.aiProvidersService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req) {
    return this.aiProvidersService.findOne(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateAiProviderDto, @Request() req) {
    return this.aiProvidersService.create(req.user.id, dto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAiProviderDto,
    @Request() req,
  ) {
    return this.aiProvidersService.update(id, req.user.id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Request() req) {
    return this.aiProvidersService.remove(id, req.user.id);
  }

  /**
   * Тестирует подключение к провайдеру, отправляя минимальный запрос.
   */
  @Post(":id/test")
  testConnection(@Param("id") id: string, @Request() req) {
    return this.aiProvidersService.testConnection(id, req.user.id);
  }
}
