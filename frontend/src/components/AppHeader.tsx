import React from "react";
import { Layout, Avatar, Dropdown, Button, Space, Typography } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/store/authStore";

const { Header } = Layout;
const { Text } = Typography;

export const AppHeader: React.FC = () => {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  const menuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Профиль",
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Настройки",
    },
    {
      type: "divider" as const,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Выйти",
      onClick: handleLogout,
    },
  ];

  return (
    <Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
        padding: "0 24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div>
        <Text strong style={{ fontSize: "18px" }}>
          BotManager
        </Text>
      </div>

      <Space>
        <Dropdown menu={{ items: menuItems }} placement="bottomRight" arrow>
          <Button
            type="text"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{ backgroundColor: "#1890ff" }}
            />
            <Text>{user?.firstName || user?.email}</Text>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
};
