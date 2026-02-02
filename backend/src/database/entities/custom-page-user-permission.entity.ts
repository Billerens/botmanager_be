import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { CustomPage } from "./custom-page.entity";
import { PermissionAction } from "./bot-user-permission.entity";

export enum CustomPageEntity {
  PAGE = "page",
  CUSTOM_PAGE_USERS = "custom_page_users",
}

@Entity("custom_page_user_permissions")
export class CustomPageUserPermission {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CustomPage, { onDelete: "CASCADE" })
  @JoinColumn({ name: "customPageId" })
  customPage: CustomPage;
  @Column()
  customPageId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
  @Column()
  userId: string;

  @Column({
    type: "enum",
    enum: CustomPageEntity,
  })
  entity: CustomPageEntity;

  @Column({
    type: "enum",
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column({ default: false })
  granted: boolean;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "grantedByUserId" })
  grantedByUser?: User;
  @Column({ nullable: true })
  grantedByUserId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
