import React from "react";
import {
  Layout,
  Typography,
  Button,
  Card,
  Row,
  Col,
  Space,
  List,
  Avatar,
  Divider,
} from "antd";
import {
  RobotOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  BarChartOutlined,
  SecurityScanOutlined,
  CustomerServiceOutlined,
  CheckCircleOutlined,
  StarOutlined,
  RocketOutlined,
  SettingOutlined,
  ApiOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

export const LandingPage: React.FC = () => {
  const features = [
    {
      icon: <RobotOutlined style={{ fontSize: "32px", color: "#1890ff" }} />,
      title: "Управление ботами",
      description:
        "Создавайте и настраивайте Telegram-ботов без программирования",
    },
    {
      icon: (
        <ThunderboltOutlined style={{ fontSize: "32px", color: "#52c41a" }} />
      ),
      title: "Быстрая настройка",
      description: "Интуитивный интерфейс для создания диалогов и сценариев",
    },
    {
      icon: <TeamOutlined style={{ fontSize: "32px", color: "#fa8c16" }} />,
      title: "CRM система",
      description: "Сбор и управление лидами, аналитика и отчеты",
    },
    {
      icon: <BarChartOutlined style={{ fontSize: "32px", color: "#722ed1" }} />,
      title: "Аналитика",
      description: "Детальная статистика по ботам и пользователям",
    },
    {
      icon: (
        <SecurityScanOutlined style={{ fontSize: "32px", color: "#eb2f96" }} />
      ),
      title: "Безопасность",
      description: "Шифрование токенов, защита данных, роли доступа",
    },
    {
      icon: <ApiOutlined style={{ fontSize: "32px", color: "#13c2c2" }} />,
      title: "Интеграции",
      description: "Webhooks, API, интеграция с внешними сервисами",
    },
  ];

  const plans = [
    {
      name: "Start",
      price: "0",
      period: "месяц",
      description: "Для начинающих",
      features: [
        "1 бот",
        "100 сообщений/месяц",
        "Базовая аналитика",
        "Email поддержка",
        "Документация",
      ],
      buttonText: "Начать бесплатно",
      popular: false,
    },
    {
      name: "Business",
      price: "29",
      period: "месяц",
      description: "Для растущего бизнеса",
      features: [
        "5 ботов",
        "10,000 сообщений/месяц",
        "Расширенная аналитика",
        "Приоритетная поддержка",
        "CRM функции",
        "Webhooks",
      ],
      buttonText: "Выбрать план",
      popular: true,
    },
    {
      name: "Pro",
      price: "99",
      period: "месяц",
      description: "Для крупных проектов",
      features: [
        "Неограниченно ботов",
        "Неограниченно сообщений",
        "Полная аналитика",
        "24/7 поддержка",
        "Все CRM функции",
        "API доступ",
        "Интеграции",
        "Персональный менеджер",
      ],
      buttonText: "Выбрать план",
      popular: false,
    },
  ];

  const testimonials = [
    {
      name: "Алексей Петров",
      role: "Основатель стартапа",
      content:
        "BotManager помог нам автоматизировать работу с клиентами. Экономия времени колоссальная!",
      avatar: "AP",
    },
    {
      name: "Мария Сидорова",
      role: "Маркетолог",
      content:
        "Простой интерфейс, мощные возможности. Наши боты работают 24/7 и приносят лидов.",
      avatar: "МС",
    },
    {
      name: "Дмитрий Козлов",
      role: "IT директор",
      content:
        "Отличная платформа для управления множеством ботов. API и интеграции на высоте.",
      avatar: "ДК",
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
            padding: "80px 24px",
            textAlign: "center",
          }}
        >
          <Title
            level={1}
            style={{ color: "white", fontSize: "48px", marginBottom: "24px" }}
          >
            Управляйте Telegram-ботами
            <br />
            <Text style={{ color: "#ffd700" }}>без программирования</Text>
          </Title>
          <Paragraph
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "20px",
              maxWidth: "600px",
              margin: "0 auto 40px",
            }}
          >
            Создавайте, настраивайте и масштабируйте Telegram-ботов с помощью
            интуитивного веб-интерфейса. Собирайте лидов, автоматизируйте
            процессы и увеличивайте продажи.
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
                <RocketOutlined /> Начать бесплатно
              </Button>
            </Link>
            <Link to="/demo">
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
                <SettingOutlined /> Демо
              </Button>
            </Link>
          </Space>
        </div>

        {/* Features Section */}
        <div style={{ padding: "80px 24px", background: "#fafafa" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <Title level={2}>Почему выбирают BotManager?</Title>
            <Paragraph
              style={{ fontSize: "18px", maxWidth: "600px", margin: "0 auto" }}
            >
              Все необходимые инструменты для создания и управления
              Telegram-ботами в одном месте
            </Paragraph>
          </div>
          <Row gutter={[32, 32]}>
            {features.map((feature, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <Card
                  style={{
                    textAlign: "center",
                    height: "100%",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
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

        {/* Pricing Section */}
        <div style={{ padding: "80px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <Title level={2}>Выберите подходящий план</Title>
            <Paragraph
              style={{ fontSize: "18px", maxWidth: "600px", margin: "0 auto" }}
            >
              Гибкие тарифы для любого размера бизнеса
            </Paragraph>
          </div>
          <Row gutter={[32, 32]} justify="center">
            {plans.map((plan, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <Card
                  style={{
                    textAlign: "center",
                    height: "100%",
                    border: plan.popular
                      ? "2px solid #1890ff"
                      : "1px solid #d9d9d9",
                    position: "relative",
                    boxShadow: plan.popular
                      ? "0 8px 24px rgba(24,144,255,0.2)"
                      : "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  {plan.popular && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-12px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "#1890ff",
                        color: "white",
                        padding: "4px 16px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      <StarOutlined /> Популярный
                    </div>
                  )}
                  <Title level={3}>{plan.name}</Title>
                  <div style={{ marginBottom: "24px" }}>
                    <Text
                      style={{
                        fontSize: "48px",
                        fontWeight: "bold",
                        color: "#1890ff",
                      }}
                    >
                      {plan.price}
                    </Text>
                    <Text style={{ fontSize: "18px", color: "#666" }}>
                      ₽/{plan.period}
                    </Text>
                  </div>
                  <Paragraph style={{ color: "#666", marginBottom: "32px" }}>
                    {plan.description}
                  </Paragraph>
                  <List
                    dataSource={plan.features}
                    renderItem={(item) => (
                      <List.Item style={{ border: "none", padding: "8px 0" }}>
                        <CheckCircleOutlined
                          style={{ color: "#52c41a", marginRight: "8px" }}
                        />
                        {item}
                      </List.Item>
                    )}
                    style={{ textAlign: "left", marginBottom: "32px" }}
                  />
                  <Link to="/register">
                    <Button
                      type={plan.popular ? "primary" : "default"}
                      size="large"
                      style={{
                        width: "100%",
                        height: "48px",
                        fontSize: "16px",
                      }}
                    >
                      {plan.buttonText}
                    </Button>
                  </Link>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Testimonials Section */}
        <div style={{ padding: "80px 24px", background: "#fafafa" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <Title level={2}>Что говорят наши клиенты</Title>
            <Paragraph
              style={{ fontSize: "18px", maxWidth: "600px", margin: "0 auto" }}
            >
              Более 1000+ компаний уже используют BotManager
            </Paragraph>
          </div>
          <Row gutter={[32, 32]}>
            {testimonials.map((testimonial, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <Card
                  style={{
                    height: "100%",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ marginBottom: "16px" }}>
                    <Avatar
                      size={48}
                      style={{
                        backgroundColor: "#1890ff",
                        marginRight: "12px",
                      }}
                    >
                      {testimonial.avatar}
                    </Avatar>
                    <div
                      style={{ display: "inline-block", verticalAlign: "top" }}
                    >
                      <div style={{ fontWeight: "bold" }}>
                        {testimonial.name}
                      </div>
                      <div style={{ color: "#666", fontSize: "14px" }}>
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                  <Paragraph style={{ fontStyle: "italic", color: "#666" }}>
                    "{testimonial.content}"
                  </Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* CTA Section */}
        <div
          style={{
            background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
            color: "white",
            padding: "80px 24px",
            textAlign: "center",
          }}
        >
          <Title level={2} style={{ color: "white", marginBottom: "24px" }}>
            Готовы начать?
          </Title>
          <Paragraph
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "18px",
              maxWidth: "600px",
              margin: "0 auto 40px",
            }}
          >
            Присоединяйтесь к тысячам пользователей, которые уже автоматизируют
            свои бизнес-процессы с помощью BotManager
          </Paragraph>
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
              <RocketOutlined /> Создать аккаунт
            </Button>
          </Link>
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
        <Paragraph
          style={{ color: "rgba(255,255,255,0.7)", marginBottom: "24px" }}
        >
          Платформа для управления Telegram-ботами нового поколения
        </Paragraph>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>
          © 2024 BotManager. Все права защищены.
        </div>
      </Footer>
    </Layout>
  );
};
