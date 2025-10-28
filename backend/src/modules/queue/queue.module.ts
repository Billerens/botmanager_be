import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { QueueService } from "./queue.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "message-queue",
    }),
    BullModule.registerQueue({
      name: "webhook-queue",
    }),
    BullModule.registerQueue({
      name: "booking-reminder-queue",
    }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
