import { Module } from "@nestjs/common";
import { BotManagerWebSocketGateway } from "./websocket.gateway";

@Module({
  providers: [BotManagerWebSocketGateway],
  exports: [BotManagerWebSocketGateway],
})
export class WebSocketModule {}
