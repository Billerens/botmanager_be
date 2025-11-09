import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ActivityLog } from "../../database/entities/activity-log.entity";
import { ActivityLogService } from "./activity-log.service";
import { ActivityLogController } from "./activity-log.controller";
import { ActivityLogCleanupService } from "./activity-log-cleanup.service";

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityLogService, ActivityLogCleanupService],
  controllers: [ActivityLogController],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
