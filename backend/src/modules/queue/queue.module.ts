import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';

// Проверяем наличие Redis
const hasRedis = !!process.env.REDIS_URL || !!process.env.REDIS_HOST;

@Module({
  imports: hasRedis ? [
    BullModule.registerQueue({
      name: 'message-queue',
    }),
    BullModule.registerQueue({
      name: 'webhook-queue',
    }),
  ] : [],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
