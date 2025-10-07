import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Typography, Space, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/authService";

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();

  // Отслеживаем изменения состояния аутентификации
  useEffect(() => {
    console.log("LoginPage - isAuthenticated changed:", isAuthenticated);
    if (isAuthenticated) {
      console.log("User is authenticated, navigating to dashboard");
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values: { email: string; password: string }) => {
    console.log("Login attempt started");
    setLoading(true);
    try {
      console.log("Calling authService.login");
      const response = await authService.login(values);
      console.log("Login response:", response);
      console.log("Calling setAuth");
      setAuth(response.user, response.accessToken);
      console.log("setAuth called, checking state...");
      message.success("Успешный вход в систему");
    } catch (error: any) {
      console.error("Ошибка входа:", error);
      message.error(error.response?.data?.message || "Ошибка входа в систему");
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
            <Text type="secondary">Войдите в свой аккаунт</Text>
          </div>

          <Form name="login" onFinish={onFinish} layout="vertical" size="large">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "Введите email" },
                { type: "email", message: "Некорректный email" },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="Email" />
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

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ width: "100%", height: "48px" }}
              >
                Войти
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: "center" }}>
            <Text>
              Нет аккаунта?{" "}
              <Link to="/register" style={{ color: "#1890ff" }}>
                Зарегистрироваться
              </Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};
