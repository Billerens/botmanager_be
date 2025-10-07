import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Typography, Space, message } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/authService";

const { Title, Text } = Typography;

export const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();

  // Отслеживаем изменения состояния аутентификации
  useEffect(() => {
    console.log("RegisterPage - isAuthenticated changed:", isAuthenticated);
    if (isAuthenticated) {
      console.log("User is authenticated, navigating to dashboard");
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName?: string;
    lastName?: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.register({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      });
      setAuth(response.user, response.accessToken);
      message.success("Регистрация прошла успешно");
    } catch (error: any) {
      console.error("Ошибка регистрации:", error);
      message.error(error.response?.data?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          borderRadius: "12px",
        }}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
              BotManager
            </Title>
            <Text type="secondary">Создайте новый аккаунт</Text>
          </div>

          <Form
            name="register"
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "Введите email" },
                { type: "email", message: "Некорректный email" },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="Email" />
            </Form.Item>

            <Form.Item name="firstName" rules={[{ required: false }]}>
              <Input
                prefix={<UserOutlined />}
                placeholder="Имя (необязательно)"
              />
            </Form.Item>

            <Form.Item name="lastName" rules={[{ required: false }]}>
              <Input
                prefix={<UserOutlined />}
                placeholder="Фамилия (необязательно)"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: "Введите пароль" },
                {
                  min: 6,
                  message: "Пароль должен содержать минимум 6 символов",
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              rules={[{ required: true, message: "Подтвердите пароль" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Подтвердите пароль"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ width: "100%", height: "48px" }}
              >
                Зарегистрироваться
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: "center" }}>
            <Text>
              Уже есть аккаунт?{" "}
              <Link to="/login" style={{ color: "#1890ff" }}>
                Войти
              </Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};
