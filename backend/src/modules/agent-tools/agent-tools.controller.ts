import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AgentToolsService } from "./agent-tools.service";
import {
  ExecuteAgentToolsDto,
  ExecuteAgentToolsResponseDto,
  UndoAgentActionDto,
  UndoAgentActionResponseDto,
} from "./dto/agent-tools.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("agent-tools")
@Controller("api/v1/agent-tools")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentToolsController {
  private readonly logger = new Logger(AgentToolsController.name);

  constructor(private readonly agentToolsService: AgentToolsService) {}

  /**
   * Выполняет инструменты агента
   */
  @Post("execute")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Execute agent tools",
    description: "Выполняет инструменты агента для применения изменений в системе",
  })
  @ApiResponse({
    status: 200,
    description: "Tools executed successfully",
    type: ExecuteAgentToolsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid tool calls",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async executeTools(
    @Body() executeDto: ExecuteAgentToolsDto,
  ): Promise<ExecuteAgentToolsResponseDto> {
    this.logger.debug("Execute agent tools request received");

    try {
      const result = await this.agentToolsService.executeTools(executeDto.toolCalls);
      this.logger.debug(`Executed ${executeDto.toolCalls.length} tools successfully`);
      return result;
    } catch (error) {
      this.logger.error("Error executing agent tools:", error);
      throw error;
    }
  }

  /**
   * Отменяет действие агента
   */
  @Post("undo")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Undo agent action",
    description: "Отменяет ранее выполненное действие агента",
  })
  @ApiResponse({
    status: 200,
    description: "Action undone successfully",
    type: UndoAgentActionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid action ID",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async undoAction(
    @Body() undoDto: UndoAgentActionDto,
  ): Promise<UndoAgentActionResponseDto> {
    this.logger.debug("Undo agent action request received");

    try {
      const result = await this.agentToolsService.undoAction(undoDto);
      this.logger.debug(`Action ${undoDto.actionId} undone successfully`);
      return result;
    } catch (error) {
      this.logger.error("Error undoing agent action:", error);
      throw error;
    }
  }
}
