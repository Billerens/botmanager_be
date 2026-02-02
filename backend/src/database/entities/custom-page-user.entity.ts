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
import { CustomPageEntity } from "./custom-page-user-permission.entity";

@Entity("custom_page_users")
export class CustomPageUser {
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

  @Column({ nullable: true })
  displayName: string;

  @Column({ type: "jsonb", nullable: true })
  permissions: Record<CustomPageEntity, PermissionAction[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
