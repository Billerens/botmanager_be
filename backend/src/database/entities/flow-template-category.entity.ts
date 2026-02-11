import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export interface LocalizedString {
  ru: string;
  en: string;
  pl: string;
  de: string;
  ua: string;
}

@Entity("flow_template_categories")
export class FlowTemplateCategory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 64, unique: true })
  slug: string;

  @Column({ type: "jsonb" })
  name: LocalizedString;

  @Column({ type: "jsonb", nullable: true })
  description: Partial<LocalizedString>;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
