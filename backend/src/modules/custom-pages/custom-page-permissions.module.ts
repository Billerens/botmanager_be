import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { CustomPageUser } from "../../database/entities/custom-page-user.entity";
import { CustomPageUserPermission } from "../../database/entities/custom-page-user-permission.entity";
import { User } from "../../database/entities/user.entity";
import { CustomPagePermissionsService } from "./custom-page-permissions.service";
import { CustomPagePermissionGuard } from "./guards/custom-page-permission.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomPage,
      CustomPageUser,
      CustomPageUserPermission,
      User,
    ]),
  ],
  providers: [CustomPagePermissionsService, CustomPagePermissionGuard],
  exports: [CustomPagePermissionsService, CustomPagePermissionGuard],
})
export class CustomPagePermissionsModule {}
