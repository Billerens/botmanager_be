import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Shop } from "../../database/entities/shop.entity";
import { ShopUser } from "../../database/entities/shop-user.entity";
import { ShopUserPermission } from "../../database/entities/shop-user-permission.entity";
import { User } from "../../database/entities/user.entity";
import { ShopPermissionsService } from "./shop-permissions.service";
import { ShopPermissionGuard } from "./guards/shop-permission.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([Shop, ShopUser, ShopUserPermission, User]),
  ],
  providers: [ShopPermissionsService, ShopPermissionGuard],
  exports: [ShopPermissionsService, ShopPermissionGuard],
})
export class ShopPermissionsModule {}
