export type FlowNodeType =
  | "start"
  | "message"
  | "keyboard"
  | "condition"
  | "api"
  | "end"
  | "form"
  | "delay"
  | "variable"
  | "file"
  | "webhook"
  | "random"
  | "loop"
  | "timer"
  | "notification"
  | "integration";

export interface FlowNodeData {
  label: string;
  text?: string;
  parseMode?: "HTML" | "Markdown" | "Plain";
  buttons?: KeyboardButton[];
  isInline?: boolean;
  condition?: string;
  operator?:
    | "equals"
    | "not_equals"
    | "exists"
    | "not_exists"
    | "contains"
    | "not_contains";
  value?: string;
  trueLabel?: string;
  falseLabel?: string;
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  responseMapping?: string;
  reason?: string;

  // Form block data
  form?: {
    fields: FormField[];
    submitText: string;
    successMessage: string;
    validation?: FormValidation;
  };

  // Delay block data
  delay?: {
    value: number;
    unit: "seconds" | "minutes" | "hours" | "days";
  };

  // Variable block data
  variable?: {
    name: string;
    value: string;
    operation: "set" | "append" | "prepend" | "increment" | "decrement";
    scope: "user" | "session" | "global";
  };

  // File block data
  file?: {
    type: "upload" | "download" | "send";
    accept?: string[];
    maxSize?: number;
    url?: string;
    filename?: string;
  };

  // Webhook block data
  webhook?: {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    retryCount?: number;
  };

  // Random block data
  random?: {
    options: RandomOption[];
    variable?: string;
  };

  // Loop block data
  loop?: {
    type: "count" | "condition" | "array";
    count?: number;
    condition?: string;
    array?: string;
    variable?: string;
  };

  // Timer block data
  timer?: {
    type: "schedule" | "interval" | "timeout";
    schedule?: string; // cron expression
    interval?: number; // milliseconds
    timeout?: number; // milliseconds
    timezone?: string;
  };

  // Notification block data
  notification?: {
    type: "email" | "sms" | "push" | "webhook";
    template: string;
    recipients: string[];
    subject?: string;
  };

  // Integration block data
  integration?: {
    service: "crm" | "email" | "analytics" | "payment" | "custom";
    action: string;
    config: Record<string, any>;
  };
}

export interface FormField {
  id: string;
  label: string;
  type:
    | "text"
    | "email"
    | "phone"
    | "number"
    | "select"
    | "multiselect"
    | "date"
    | "textarea"
    | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface FormValidation {
  required: string[];
  custom?: Array<{
    field: string;
    rule: string;
    message: string;
  }>;
}

export interface RandomOption {
  value: string;
  weight?: number;
  label?: string;
}

export interface KeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
  webApp?: any;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface FlowBuilderProps {
  botId: string;
  flowData?: FlowData;
  onSave?: (flowData: FlowData) => void;
  onTest?: (flowData: FlowData) => void;
}
