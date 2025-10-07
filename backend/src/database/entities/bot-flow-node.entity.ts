import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BotFlow } from "./bot-flow.entity";

export enum NodeType {
  START = "start",
  MESSAGE = "message",
  KEYBOARD = "keyboard",
  CONDITION = "condition",
  API = "api",
  END = "end",
  FORM = "form",
  DELAY = "delay",
  VARIABLE = "variable",
  FILE = "file",
  WEBHOOK = "webhook",
  RANDOM = "random",
  LOOP = "loop",
  TIMER = "timer",
  NOTIFICATION = "notification",
  INTEGRATION = "integration",
}

export enum MessageNodeType {
  TEXT = "text",
  PHOTO = "photo",
  VIDEO = "video",
  AUDIO = "audio",
  DOCUMENT = "document",
  STICKER = "sticker",
  VOICE = "voice",
  LOCATION = "location",
  CONTACT = "contact",
}

export enum ConditionOperator {
  EQUALS = "equals",
  CONTAINS = "contains",
  STARTS_WITH = "startsWith",
  ENDS_WITH = "endsWith",
  REGEX = "regex",
  GREATER_THAN = "greaterThan",
  LESS_THAN = "lessThan",
  IS_EMPTY = "isEmpty",
  IS_NOT_EMPTY = "isNotEmpty",
}

@Entity("bot_flow_nodes")
export class BotFlowNode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  nodeId: string; // ID ноды в React Flow

  @Column({
    type: "enum",
    enum: NodeType,
  })
  type: NodeType;

  @Column()
  name: string;

  @Column({ type: "json" })
  position: {
    x: number;
    y: number;
  };

  @Column({ type: "json" })
  data: {
    // Для MESSAGE нод
    messageType?: MessageNodeType;
    text?: string;
    media?: {
      fileId?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    };
    // Для KEYBOARD нод
    buttons?: Array<{
      text: string;
      callbackData?: string;
      url?: string;
      webApp?: string;
    }>;
    isInline?: boolean;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";

    // Для CONDITION нод
    condition?: {
      field: string;
      operator: ConditionOperator;
      value: string;
      caseSensitive?: boolean;
    };

    // Для FORM нод
    form?: {
      fields: Array<{
        id: string;
        label: string;
        type:
          | "text"
          | "email"
          | "phone"
          | "number"
          | "select"
          | "multiselect"
          | "date";
        required: boolean;
        placeholder?: string;
        options?: string[];
        validation?: {
          min?: number;
          max?: number;
          pattern?: string;
        };
      }>;
      submitText: string;
      successMessage: string;
    };

    // Для DELAY нод
    delay?: {
      value: number;
      unit: "seconds" | "minutes" | "hours" | "days";
    };

    // Для WEBHOOK нод
    webhook?: {
      url: string;
      method: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    };

    // Для ASSIGNMENT нод
    assignment?: {
      variable: string;
      value: string;
      operation: "set" | "append" | "prepend" | "increment" | "decrement";
    };

    // Для RANDOM нод
    random?: {
      options: Array<{
        value: string;
        weight?: number;
        label?: string;
      }>;
      variable?: string;
    };

    // Для LOOP нод
    loop?: {
      type: "count" | "condition" | "array";
      count?: number;
      condition?: string;
      array?: string;
      variable?: string;
      maxIterations?: number;
    };

    // Для TIMER нод
    timer?: {
      type: "schedule" | "interval" | "timeout";
      schedule?: string; // cron expression
      interval?: number; // milliseconds
      timeout?: number; // milliseconds
      timezone?: string;
    };

    // Для NOTIFICATION нод
    notification?: {
      type: "email" | "sms" | "push" | "webhook";
      template: string;
      recipients: string[];
      subject?: string;
      config?: Record<string, any>;
    };

    // Для INTEGRATION нод
    integration?: {
      service: "crm" | "email" | "analytics" | "payment" | "custom";
      action: string;
      config: Record<string, any>;
      responseMapping?: string;
    };

    // Общие настройки
    nextNodeId?: string; // ID следующей ноды
    errorNodeId?: string; // ID ноды при ошибке
    retryCount?: number; // Количество попыток
    retryDelay?: number; // Задержка между попытками (мс)
  };

  @Column({ default: 0 })
  executionCount: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  errorCount: number;

  @Column({ type: "text", nullable: true })
  lastError: string;

  @Column({ nullable: true })
  lastExecutedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => BotFlow, (flow) => flow.nodes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "flowId" })
  flow: BotFlow;

  @Column()
  flowId: string;

  // Методы
  get isStart(): boolean {
    return this.type === NodeType.START;
  }

  get isMessage(): boolean {
    return this.type === NodeType.MESSAGE;
  }

  get isKeyboard(): boolean {
    return this.type === NodeType.KEYBOARD;
  }

  get isCondition(): boolean {
    return this.type === NodeType.CONDITION;
  }

  get isApi(): boolean {
    return this.type === NodeType.API;
  }

  get isEnd(): boolean {
    return this.type === NodeType.END;
  }

  get successRate(): number {
    if (this.executionCount === 0) return 0;
    return (this.successCount / this.executionCount) * 100;
  }

  get errorRate(): number {
    if (this.executionCount === 0) return 0;
    return (this.errorCount / this.executionCount) * 100;
  }
}
