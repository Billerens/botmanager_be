import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("system_settings")
export class SystemSetting {
  @PrimaryColumn({ type: "varchar", length: 100 })
  key: string;

  @Column({ type: "jsonb", default: null, nullable: true })
  value: any;

  @Column({ type: "text", nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
