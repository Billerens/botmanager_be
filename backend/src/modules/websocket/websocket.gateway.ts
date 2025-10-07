import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  },
})
export class BotManagerWebSocketGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BotManagerWebSocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Клиент подключен: ${client.id}`);
  }

  handleDisconnection(client: Socket) {
    this.logger.log(`Клиент отключен: ${client.id}`);
  }

  @SubscribeMessage("join-room")
  handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(data.room);
    this.logger.log(`Клиент ${client.id} присоединился к комнате ${data.room}`);
  }

  @SubscribeMessage("leave-room")
  handleLeaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket
  ) {
    client.leave(data.room);
    this.logger.log(`Клиент ${client.id} покинул комнату ${data.room}`);
  }

  // Методы для отправки уведомлений
  emitToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user-${userId}`).emit(event, data);
  }
}
