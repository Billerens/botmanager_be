import React, { useState } from "react";
import {
  Layout,
  Typography,
  Card,
  Row,
  Col,
  Button,
  Space,
  Steps,
  Timeline,
  Avatar,
  Badge,
  Statistic,
  Progress,
} from "antd";
import {
  RobotOutlined,
  MessageOutlined,
  UserOutlined,
  BarChartOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

export const DemoPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const demoSteps = [
    {
      title: "Создание бота",
      description: "Добавьте токен от @BotFather",
      icon: <RobotOutlined />,
      content: (
        <Card style={{ marginTop: "24px" }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Title level={4}>1. Получите токен от @BotFather</Title>
              <Paragraph>
                Создайте нового бота в Telegram через @BotFather и получите
                токен
              </Paragraph>
            </div>
            <div>
              <Title level={4}>2. Добавьте бота в BotManager</Title>
              <Paragraph>
                Вставьте токен в форму и нажмите "Создать бота"
              </Paragraph>
            </div>
            <div
              style={{
                background: "#f5f5f5",
                padding: "16px",
                borderRadius: "8px",
              }}
            >
              <Text code>1234567890:ABCdefGHIjklMNOpqrsTUVwxyz</Text>
            </div>
          </Space>
        </Card>
      ),
    },
    {
      title: "Настройка диалогов",
      description: "Создайте сценарии общения",
      icon: <MessageOutlined />,
      content: (
        <Card style={{ marginTop: "24px" }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card size="small" title="Приветствие">
                <Paragraph>👋 Привет! Я бот-помощник.</Paragraph>
                <Paragraph>Как дела? Чем могу помочь?</Paragraph>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="Ответы">
                <Paragraph>✅ Отлично! Рад помочь.</Paragraph>
                <Paragraph>❌ Понял, давайте разберемся.</Paragraph>
              </Card>
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      title: "Сбор лидов",
      description: "Настройте формы для сбора данных",
      icon: <UserOutlined />,
      content: (
        <Card style={{ marginTop: "24px" }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Title level={4}>Форма сбора лидов</Title>
              <Card size="small" style={{ background: "#f0f8ff" }}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <div>
                    <Text strong>Имя:</Text> <Text>Иван Петров</Text>
                  </div>
                  <div>
                    <Text strong>Email:</Text> <Text>ivan@example.com</Text>
                  </div>
                  <div>
                    <Text strong>Телефон:</Text> <Text>+7 (999) 123-45-67</Text>
                  </div>
                  <div>
                    <Text strong>Комментарий:</Text>{" "}
                    <Text>Интересуюсь вашими услугами</Text>
                  </div>
                </Space>
              </Card>
            </div>
          </Space>
        </Card>
      ),
    },
    {
      title: "Аналитика",
      description: "Отслеживайте эффективность",
      icon: <BarChartOutlined />,
      content: (
        <Card style={{ marginTop: "24px" }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic title="Сообщения" value={1128} />
            </Col>
            <Col span={8}>
              <Statistic title="Пользователи" value={93} />
            </Col>
            <Col span={8}>
              <Statistic title="Лиды" value={45} />
            </Col>
          </Row>
          <div style={{ marginTop: "24px" }}>
            <Title level={5}>Конверсия в лиды</Title>
            <Progress percent={75} status="active" />
          </div>
        </Card>
      ),
    },
  ];

  const features = [
    {
      icon: (
        <ThunderboltOutlined style={{ fontSize: "24px", color: "#52c41a" }} />
      ),
      title: "Быстрая настройка",
      description: "Создайте бота за 5 минут",
    },
    {
      icon: <TeamOutlined style={{ fontSize: "24px", color: "#1890ff" }} />,
      title: "CRM система",
      description: "Управляйте лидами и клиентами",
    },
    {
      icon: <GlobalOutlined style={{ fontSize: "24px", color: "#fa8c16" }} />,
      title: "Масштабирование",
      description: "Неограниченное количество ботов",
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <RobotOutlined
            style={{ fontSize: "24px", color: "#1890ff", marginRight: "12px" }}
          />
          <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
            BotManager
          </Title>
        </div>
        <Space>
          <Link to="/">
            <Button type="text">Главная</Button>
          </Link>
          <Link to="/login">
            <Button type="text">Войти</Button>
          </Link>
          <Link to="/register">
            <Button type="primary">Регистрация</Button>
          </Link>
        </Space>
      </Header>

      <Content>
        {/* Hero Section */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <Title
            level={1}
            style={{ color: "white", fontSize: "42px", marginBottom: "24px" }}
          >
            Демо BotManager
          </Title>
          <Paragraph
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "18px",
              maxWidth: "600px",
              margin: "0 auto 40px",
            }}
          >
            Посмотрите, как легко создавать и управлять Telegram-ботами с
            помощью нашего интуитивного интерфейса
          </Paragraph>
        </div>

        {/* Demo Steps */}
        <div style={{ padding: "60px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <Title level={2}>Как это работает</Title>
            <Paragraph
              style={{ fontSize: "18px", maxWidth: "600px", margin: "0 auto" }}
            >
              Простой процесс создания и настройки бота
            </Paragraph>
          </div>

          <Steps
            current={currentStep}
            onChange={setCurrentStep}
            style={{ marginBottom: "40px" }}
            items={demoSteps.map((step, index) => ({
              title: step.title,
              description: step.description,
              icon: step.icon,
            }))}
          />

          {demoSteps[currentStep]?.content}

          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <Space size="large">
              <Button
                disabled={currentStep === 0}
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                Назад
              </Button>
              <Button
                type="primary"
                disabled={currentStep === demoSteps.length - 1}
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                Далее
              </Button>
            </Space>
          </div>
        </div>

        {/* Features */}
        <div style={{ padding: "60px 24px", background: "#fafafa" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <Title level={2}>Ключевые возможности</Title>
          </div>
          <Row gutter={[32, 32]}>
            {features.map((feature, index) => (
              <Col xs={24} sm={8} key={index}>
                <Card style={{ textAlign: "center", height: "100%" }}>
                  <div style={{ marginBottom: "16px" }}>{feature.icon}</div>
                  <Title level={4}>{feature.title}</Title>
                  <Paragraph style={{ color: "#666" }}>
                    {feature.description}
                  </Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* CTA */}
        <div
          style={{
            background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
            color: "white",
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <Title level={2} style={{ color: "white", marginBottom: "24px" }}>
            Готовы попробовать?
          </Title>
          <Paragraph
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "18px",
              maxWidth: "600px",
              margin: "0 auto 40px",
            }}
          >
            Создайте свой первый бот уже сегодня
          </Paragraph>
          <Space size="large">
            <Link to="/register">
              <Button
                type="primary"
                size="large"
                style={{
                  height: "50px",
                  fontSize: "18px",
                  padding: "0 32px",
                  background: "#ffd700",
                  borderColor: "#ffd700",
                  color: "#000",
                }}
              >
                Начать бесплатно
              </Button>
            </Link>
            <Link to="/">
              <Button
                size="large"
                style={{
                  height: "50px",
                  fontSize: "18px",
                  padding: "0 32px",
                  background: "transparent",
                  borderColor: "white",
                  color: "white",
                }}
              >
                Узнать больше
              </Button>
            </Link>
          </Space>
        </div>
      </Content>

      <Footer
        style={{
          background: "#001529",
          color: "white",
          textAlign: "center",
          padding: "40px 24px",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <RobotOutlined
            style={{ fontSize: "24px", color: "#1890ff", marginRight: "12px" }}
          />
          <Title level={4} style={{ color: "white", display: "inline" }}>
            BotManager
          </Title>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>
          © 2024 BotManager. Все права защищены.
        </div>
      </Footer>
    </Layout>
  );
};
