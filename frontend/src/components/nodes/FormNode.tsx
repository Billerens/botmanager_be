import React, { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Form, Input, Select, Button, Space, Divider } from "antd";
import { FormOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { FlowNodeData, FormField } from "@/types/flow";

const { Option } = Select;
const { TextArea } = Input;

export const FormNode: React.FC<NodeProps<FlowNodeData>> = ({
  data,
  selected,
}) => {
  const [form] = Form.useForm();
  const [fields, setFields] = useState<FormField[]>(
    data.form?.fields || [
      {
        id: "field1",
        label: "Имя",
        type: "text",
        required: true,
        placeholder: "Введите ваше имя",
      },
    ]
  );

  const addField = () => {
    const newField: FormField = {
      id: `field${Date.now()}`,
      label: "Новое поле",
      type: "text",
      required: false,
    };
    setFields([...fields, newField]);
  };

  const removeField = (fieldId: string) => {
    setFields(fields.filter((field) => field.id !== fieldId));
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(
      fields.map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );
  };

  const getFieldTypeIcon = (type: string) => {
    const icons = {
      text: "📝",
      email: "📧",
      phone: "📞",
      number: "🔢",
      select: "📋",
      multiselect: "☑️",
      date: "📅",
      textarea: "📄",
      checkbox: "☑️",
    };
    return icons[type as keyof typeof icons] || "📝";
  };

  return (
    <Card
      size="small"
      style={{
        width: 300,
        border: selected ? "2px solid #1890ff" : "1px solid #d9d9d9",
        borderRadius: 8,
      }}
      title={
        <Space>
          <FormOutlined />
          <span>Форма сбора данных</span>
        </Space>
      }
    >
      <Handle type="target" position={Position.Top} />

      <div style={{ marginBottom: 12 }}>
        <Form.Item label="Текст кнопки отправки" style={{ marginBottom: 8 }}>
          <Input
            placeholder="Отправить"
            value={data.form?.submitText || "Отправить"}
            onChange={(e) => {
              data.form = {
                ...data.form,
                submitText: e.target.value,
                fields: fields,
                successMessage: data.form?.successMessage || "Спасибо!",
              };
            }}
          />
        </Form.Item>
      </div>

      <Divider style={{ margin: "8px 0" }} />

      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {fields.map((field, index) => (
          <Card
            key={field.id}
            size="small"
            style={{ marginBottom: 8, background: "#fafafa" }}
            title={
              <Space>
                <span>{getFieldTypeIcon(field.type)}</span>
                <span>Поле {index + 1}</span>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeField(field.id)}
                />
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: "100%" }} size="small">
              <Form.Item label="Название" style={{ marginBottom: 4 }}>
                <Input
                  value={field.label}
                  onChange={(e) =>
                    updateField(field.id, { label: e.target.value })
                  }
                />
              </Form.Item>

              <Form.Item label="Тип" style={{ marginBottom: 4 }}>
                <Select
                  value={field.type}
                  onChange={(value) => updateField(field.id, { type: value })}
                  style={{ width: "100%" }}
                >
                  <Option value="text">Текст</Option>
                  <Option value="email">Email</Option>
                  <Option value="phone">Телефон</Option>
                  <Option value="number">Число</Option>
                  <Option value="select">Выбор</Option>
                  <Option value="multiselect">Множественный выбор</Option>
                  <Option value="date">Дата</Option>
                  <Option value="textarea">Многострочный текст</Option>
                  <Option value="checkbox">Чекбокс</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Плейсхолдер" style={{ marginBottom: 4 }}>
                <Input
                  value={field.placeholder || ""}
                  onChange={(e) =>
                    updateField(field.id, { placeholder: e.target.value })
                  }
                />
              </Form.Item>

              <Form.Item label="Обязательное" style={{ marginBottom: 0 }}>
                <Select
                  value={field.required}
                  onChange={(value) =>
                    updateField(field.id, { required: value })
                  }
                  style={{ width: "100%" }}
                >
                  <Option value={true}>Да</Option>
                  <Option value={false}>Нет</Option>
                </Select>
              </Form.Item>
            </Space>
          </Card>
        ))}
      </div>

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={addField}
        style={{ width: "100%", marginTop: 8 }}
      >
        Добавить поле
      </Button>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
