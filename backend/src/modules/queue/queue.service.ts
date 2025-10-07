import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('message-queue') private messageQueue: Queue,
    @InjectQueue('webhook-queue') private webhookQueue: Queue,
  ) {}

  async addMessageJob(data: any) {
    return this.messageQueue.add('process-message', data);
  }

  async addWebhookJob(data: any) {
    return this.webhookQueue.add('process-webhook', data);
  }
}
