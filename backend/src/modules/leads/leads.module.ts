import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Lead } from '../../database/entities/lead.entity';
import { Bot } from '../../database/entities/bot.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Bot]), ActivityLogModule],
  providers: [LeadsService],
  controllers: [LeadsController],
  exports: [LeadsService],
})
export class LeadsModule {}
