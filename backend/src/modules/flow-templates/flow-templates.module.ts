import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FlowTemplate } from "../../database/entities/flow-template.entity";
import { FlowTemplateCategory } from "../../database/entities/flow-template-category.entity";
import { FlowTemplatesService } from "./flow-templates.service";
import { FlowTemplateCategoriesService } from "./flow-template-categories.service";
import { FlowTemplatesController } from "./flow-templates.controller";

@Module({
  imports: [TypeOrmModule.forFeature([FlowTemplate, FlowTemplateCategory])],
  providers: [FlowTemplatesService, FlowTemplateCategoriesService],
  controllers: [FlowTemplatesController],
  exports: [FlowTemplatesService, FlowTemplateCategoriesService],
})
export class FlowTemplatesModule {}
