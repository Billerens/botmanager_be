import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  constructor(
    @Optional() @InjectQueue('message-queue') private messageQueue?: Queue,
    @Optional() @InjectQueue('webhook-queue') private webhookQueue?: Queue,
  ) {}

  async addMessageJob(data: any) {
    if (this.messageQueue) {
      return this.messageQueue.add('process-message', data);
    } else {
      console.log('⚠️ Redis не настроен, задача обработки сообщения пропущена:', data);
      return null;
    }
  }

  async addWebhookJob(data: any) {
    if (this.webhookQueue) {
      return this.webhookQueue.add('process-webhook', data);
    } else {
      console.log('⚠️ Redis не настроен, задача обработки webhook пропущена:', data);
      return null;
    }
  }
}
