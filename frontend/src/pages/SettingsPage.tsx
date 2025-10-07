import React, { useState, useEffect } from "react";
import { Card, Typography, Form, Input, Button, message, Space } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/authService";

const { Title } = Typography;

export const SettingsPage: React.FC = () => {
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { user, setUser } = useAuthStore();

  const onProfileFinish = async (values: any) => {
    setProfileLoading(true);
    try {
      const updatedUser = await authService.updateProfile({
        firstName: values.firstName,
        lastName: values.lastName,
      });
      setUser(updatedUser);
      message.success("Профиль обновлен");
    } catch (error: any) {
      message.error(
        error.response?.data?.message || "Ошибка обновления профиля"
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const onPasswordFinish = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error("Пароли не совпадают");
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success("Пароль успешно изменен");
    } catch (error: any) {
      message.error(error.response?.data?.message || "Ошибка изменения пароля");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Настройки
      </Title>

      <Card title="Профиль" style={{ marginBottom: "24px" }}>
        <Form
          layout="vertical"
          onFinish={onProfileFinish}
          initialValues={{
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
          }}
        >
          <Form.Item name="firstName" label="Имя">
            <Input prefix={<UserOutlined />} />
          </Form.Item>

          <Form.Item name="lastName" label="Фамилия">
            <Input prefix={<UserOutlined />} />
          </Form.Item>

          <Form.Item name="email" label="Email">
            <Input prefix={<UserOutlined />} disabled />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={profileLoading}>
              Сохранить
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Безопасность">
        <Form layout="vertical" onFinish={onPasswordFinish}>
          <Form.Item
            name="currentPassword"
            label="Текущий пароль"
            rules={[{ required: true, message: "Введите текущий пароль" }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Новый пароль"
            rules={[
              { required: true, message: "Введите новый пароль" },
              { min: 6, message: "Пароль должен содержать минимум 6 символов" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Подтвердите пароль"
            rules={[
              { required: true, message: "Подтвердите пароль" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Пароли не совпадают"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordLoading}>
              Изменить пароль
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
