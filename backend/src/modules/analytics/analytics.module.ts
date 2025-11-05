import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Bot } from '../../database/entities/bot.entity';
import { Message } from '../../database/entities/message.entity';
import { Lead } from '../../database/entities/lead.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bot, Message, Lead])],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
