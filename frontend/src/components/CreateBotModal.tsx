import React, { useState } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  Steps,
  Card,
  Typography,
  Space,
  Alert,
} from "antd";
import { RobotOutlined, KeyOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface CreateBotModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (values: { name: string; description?: string; token: string }) => void;
  loading?: boolean;
}

export const CreateBotModal: React.FC<CreateBotModalProps> = ({
  visible,
  onCancel,
  onOk,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        console.log("Form values:", values);
        onOk(values);
      })
      .catch((errorInfo) => {
        console.log("Validation failed:", errorInfo);
      });
  };

  const handleCancel = () => {
    setCurrentStep(0);
    form.resetFields();
    onCancel();
  };

  const steps = [
    {
      title: "Создайте бота",
      description: "В Telegram через @BotFather",
      content: (
        <div style={{ minHeight: "200px" }}>
          <Alert
            message="Шаг 1: Создайте бота в Telegram"
            description="Откройте Telegram и найдите @BotFather, затем выполните команду /newbot"
            type="info"
            style={{ marginBottom: "20px" }}
          />
          <Card size="small" style={{ background: "#f5f5f5", padding: "16px" }}>
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <Text strong>1. Откройте @BotFather в Telegram</Text>
              <Text>2. Отправьте команду /newbot</Text>
              <Text>3. Введите название бота (например: "Мой бот")</Text>
              <Text>4. Введите username бота (например: "my_bot")</Text>
              <Text>5. Скопируйте полученный токен</Text>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      title: "Получите токен",
      description: "Скопируйте токен от @BotFather",
      content: (
        <div style={{ minHeight: "200px" }}>
          <Alert
            message="Шаг 2: Получите токен бота"
            description="После создания бота @BotFather отправит вам токен вида: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            type="success"
            style={{ marginBottom: "20px" }}
          />
          <Card size="small" style={{ background: "#f0f8ff", padding: "16px" }}>
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <Text strong>Пример токена:</Text>
              <div
                style={{
                  background: "#fff",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #d9d9d9",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  wordBreak: "break-all",
                  textAlign: "center",
                }}
              >
                1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
              </div>
              <Text
                type="secondary"
                style={{ fontSize: "13px", textAlign: "center" }}
              >
                ⚠️ Никому не передавайте этот токен!
              </Text>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      title: "Добавьте в BotManager",
      description: "Введите данные бота",
      content: (
        <div style={{ minHeight: "200px" }}>
          <Alert
            message="Шаг 3: Добавьте бота в BotManager"
            description="Заполните форму ниже с данными вашего бота"
            type="warning"
            style={{ marginBottom: "20px" }}
          />
          <Form form={form} layout="vertical" style={{ padding: "0 8px" }}>
            <Form.Item
              name="name"
              label="Название бота"
              rules={[{ required: true, message: "Введите название бота" }]}
            >
              <Input placeholder="Название бота" size="large" />
            </Form.Item>

            <Form.Item name="description" label="Описание (необязательно)">
              <Input.TextArea
                placeholder="Описание бота"
                rows={3}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="token"
              label="Токен бота"
              rules={[{ required: true, message: "Введите токен бота" }]}
            >
              <Input.Password placeholder="Токен от @BotFather" size="large" />
            </Form.Item>
          </Form>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>Создать нового бота</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={700}
      style={{ top: 20 }}
      bodyStyle={{ padding: "24px 0 0 0" }}
    >
      <Form form={form} layout="vertical">
        <Steps
          current={currentStep}
          onChange={setCurrentStep}
          style={{ marginBottom: "32px" }}
          size="small"
          items={steps.map((step, index) => ({
            title: step.title,
            description: step.description,
            icon: index === 2 ? <KeyOutlined /> : <RobotOutlined />,
          }))}
        />

        {steps[currentStep]?.content}
      </Form>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "32px",
          padding: "16px 0",
          borderTop: "1px solid #f0f0f0",
        }}
      >
        {currentStep < 2 ? (
          <Button
            type="primary"
            onClick={() => setCurrentStep(currentStep + 1)}
            style={{ minWidth: "100px" }}
          >
            Далее
          </Button>
        ) : (
          <Space>
            <Button
              onClick={() => setCurrentStep(currentStep - 1)}
              style={{ minWidth: "100px" }}
            >
              Назад
            </Button>
            <Button
              type="primary"
              onClick={handleOk}
              loading={loading}
              style={{ minWidth: "120px" }}
            >
              Создать бота
            </Button>
          </Space>
        )}
      </div>
    </Modal>
  );
};
