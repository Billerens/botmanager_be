import { Module } from "@nestjs/common";
import { BytezController } from "./bytez.controller";
import { BytezService } from "../../common/bytez.service";

@Module({
  controllers: [BytezController],
  providers: [BytezService],
  exports: [BytezService],
})
export class BytezModule {}

