import React from "react";
import { Layout, Menu } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DashboardOutlined,
  RobotOutlined,
  UserOutlined,
  BarChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

const menuItems = [
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: "Дашборд",
  },
  {
    key: "/bots",
    icon: <RobotOutlined />,
    label: "Боты",
  },
  {
    key: "/leads",
    icon: <UserOutlined />,
    label: "Заявки",
  },
  {
    key: "/analytics",
    icon: <BarChartOutlined />,
    label: "Аналитика",
  },
  {
    key: "/settings",
    icon: <SettingOutlined />,
    label: "Настройки",
  },
];

export const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Sider
      width={250}
      style={{
        background: "#fff",
        boxShadow: "2px 0 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ margin: 0, color: "#1890ff" }}>BotManager</h3>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          border: "none",
          background: "transparent",
        }}
      />
    </Sider>
  );
};
