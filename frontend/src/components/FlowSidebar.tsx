import React from "react";
import {
  Card,
  Typography,
  Space,
  Button,
  Divider,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  message,
} from "antd";
import {
  PlayCircleOutlined,
  MessageOutlined,
  AppstoreOutlined,
  QuestionCircleOutlined,
  ApiOutlined,
  StopOutlined,
  DeleteOutlined,
  FormOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileOutlined,
  QuestionCircleOutlined as RandomOutlined,
} from "@ant-design/icons";
import { Node } from "reactflow";
import { FlowNodeData, FlowNodeType } from "@/types/flow";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface FlowSidebarProps {
  onAddNode: (type: FlowNodeType, position: { x: number; y: number }) => void;
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

const nodeTypes = [
  {
    type: "message" as FlowNodeType,
    label: "Сообщение",
    icon: <MessageOutlined />,
    description: "Отправить текстовое сообщение",
  },
  {
    type: "keyboard" as FlowNodeType,
    label: "Клавиатура",
    icon: <AppstoreOutlined />,
    description: "Добавить кнопки",
  },
  {
    type: "condition" as FlowNodeType,
    label: "Условие",
    icon: <QuestionCircleOutlined />,
    description: "Проверить условие",
  },
  {
    type: "api" as FlowNodeType,
    label: "API запрос",
    icon: <ApiOutlined />,
    description: "Выполнить HTTP запрос",
  },
  {
    type: "form" as FlowNodeType,
    label: "Форма",
    icon: <FormOutlined />,
    description: "Сбор данных через форму",
  },
  {
    type: "delay" as FlowNodeType,
    label: "Задержка",
    icon: <ClockCircleOutlined />,
    description: "Пауза в выполнении",
  },
  {
    type: "variable" as FlowNodeType,
    label: "Переменная",
    icon: <DatabaseOutlined />,
    description: "Работа с переменными",
  },
  {
    type: "file" as FlowNodeType,
    label: "Файл",
    icon: <FileOutlined />,
    description: "Работа с файлами",
  },
  {
    type: "random" as FlowNodeType,
    label: "Случайный выбор",
    icon: <RandomOutlined />,
    description: "Случайный выбор из вариантов",
  },
  {
    type: "end" as FlowNodeType,
    label: "Конец",
    icon: <StopOutlined />,
    description: "Завершить диалог",
  },
];

export const FlowSidebar: React.FC<FlowSidebarProps> = ({
  onAddNode,
  selectedNode,
  onUpdateNode,
  onDeleteNode,
}) => {
  const [form] = Form.useForm();

  // Обновляем форму при изменении выбранного узла
  React.useEffect(() => {
    if (selectedNode) {
      const nodeData = selectedNode.data as FlowNodeData;
      const formData = { ...nodeData };

      // Для клавиатуры конвертируем массив кнопок в JSON строку
      if (selectedNode.type === "keyboard" && formData.buttons) {
        (formData as any).buttons = JSON.stringify(formData.buttons, null, 2);
      }

      form.setFieldsValue(formData);
    }
  }, [selectedNode, form]);

  const handleAddNode = (type: FlowNodeType) => {
    // Добавляем узел в центр экрана
    onAddNode(type, { x: 400, y: 300 });
  };

  const handleUpdateNode = (values: any) => {
    if (selectedNode) {
      const updatedData = { ...values };

      // Для клавиатуры парсим JSON строку обратно в массив
      if (selectedNode.type === "keyboard" && values.buttons) {
        try {
          updatedData.buttons = JSON.parse(values.buttons);
        } catch (error) {
          message.error("Неверный формат JSON для кнопок");
          return;
        }
      }

      onUpdateNode(selectedNode.id, updatedData);
      message.success("Узел обновлен");
    }
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      onDeleteNode(selectedNode.id);
      message.success("Узел удален");
    }
  };

  // Конвертируем данные для формы (выносим useMemo наверх)
  const formData = React.useMemo(() => {
    if (!selectedNode) return {};

    const nodeData = selectedNode.data as FlowNodeData;
    const data = { ...nodeData };

    // Для клавиатуры конвертируем массив кнопок в JSON строку
    if (selectedNode.type === "keyboard" && data.buttons) {
      (data as any).buttons = JSON.stringify(data.buttons, null, 2);
    }

    return data;
  }, [selectedNode]);

  const renderNodeEditor = () => {
    if (!selectedNode) {
      return (
        <Card size="small">
          <Text type="secondary">Выберите узел для редактирования</Text>
        </Card>
      );
    }

    return (
      <Card size="small" title={`Редактирование: ${selectedNode.type}`}>
        <Form
          form={form}
          layout="vertical"
          initialValues={formData}
          onFinish={handleUpdateNode}
        >
          <Form.Item label="Название" name="label">
            <Input />
          </Form.Item>

          {selectedNode.type === "message" && (
            <>
              <Form.Item label="Текст сообщения" name="text">
                <TextArea rows={4} />
              </Form.Item>
              <Form.Item label="Режим парсинга" name="parseMode">
                <Select>
                  <Option value="HTML">HTML</Option>
                  <Option value="Markdown">Markdown</Option>
                  <Option value="Plain">Обычный текст</Option>
                </Select>
              </Form.Item>
            </>
          )}

          {selectedNode.type === "keyboard" && (
            <>
              <Form.Item label="Кнопки" name="buttons">
                <TextArea
                  rows={6}
                  placeholder='[{"text": "Кнопка 1", "callbackData": "btn1"}]'
                />
              </Form.Item>
              <Form.Item
                label="Inline клавиатура"
                name="isInline"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </>
          )}

          {selectedNode.type === "condition" && (
            <>
              <Form.Item label="Поле для проверки" name="condition">
                <Input placeholder="user.firstName" />
              </Form.Item>
              <Form.Item label="Оператор" name="operator">
                <Select>
                  <Option value="equals">Равно</Option>
                  <Option value="not_equals">Не равно</Option>
                  <Option value="exists">Существует</Option>
                  <Option value="not_exists">Не существует</Option>
                  <Option value="contains">Содержит</Option>
                  <Option value="not_contains">Не содержит</Option>
                </Select>
              </Form.Item>
              <Form.Item label="Значение" name="value">
                <Input />
              </Form.Item>
              <Form.Item label="Метка для 'Да'" name="trueLabel">
                <Input />
              </Form.Item>
              <Form.Item label="Метка для 'Нет'" name="falseLabel">
                <Input />
              </Form.Item>
            </>
          )}

          {selectedNode.type === "api" && (
            <>
              <Form.Item label="URL" name="url">
                <Input placeholder="https://api.example.com/endpoint" />
              </Form.Item>
              <Form.Item label="Метод" name="method">
                <Select>
                  <Option value="GET">GET</Option>
                  <Option value="POST">POST</Option>
                  <Option value="PUT">PUT</Option>
                  <Option value="DELETE">DELETE</Option>
                </Select>
              </Form.Item>
              <Form.Item label="Заголовки" name="headers">
                <TextArea
                  rows={3}
                  placeholder='{"Content-Type": "application/json"}'
                />
              </Form.Item>
              <Form.Item label="Тело запроса" name="body">
                <TextArea rows={4} placeholder='{"key": "value"}' />
              </Form.Item>
              <Form.Item label="Маппинг ответа" name="responseMapping">
                <Input placeholder="response.data" />
              </Form.Item>
            </>
          )}

          {selectedNode.type === "end" && (
            <Form.Item label="Причина завершения" name="reason">
              <Input placeholder="Диалог завершен" />
            </Form.Item>
          )}

          <Space>
            <Button type="primary" htmlType="submit">
              Сохранить
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDeleteNode}>
              Удалить
            </Button>
          </Space>
        </Form>
      </Card>
    );
  };

  return (
    <div
      style={{
        width: 300,
        height: "100%",
        borderRight: "1px solid #f0f0f0",
        overflowY: "auto",
        padding: 16,
        backgroundColor: "#fafafa",
      }}
    >
      <Title level={4}>Элементы диалога</Title>

      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
        {nodeTypes.map((nodeType) => (
          <Card
            key={nodeType.type}
            size="small"
            hoverable
            style={{ cursor: "pointer" }}
            onClick={() => handleAddNode(nodeType.type)}
          >
            <Space>
              {nodeType.icon}
              <div>
                <div style={{ fontWeight: 500 }}>{nodeType.label}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {nodeType.description}
                </Text>
              </div>
            </Space>
          </Card>
        ))}
      </Space>

      <Divider />

      <Title level={5}>Редактирование</Title>
      {renderNodeEditor()}
    </div>
  );
};
