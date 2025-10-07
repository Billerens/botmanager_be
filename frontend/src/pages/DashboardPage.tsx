import React, { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Typography, Spin } from "antd";
import {
  RobotOutlined,
  UserOutlined,
  MessageOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useQuery } from "react-query";
import { botsService } from "@/services/botsService";

const { Title } = Typography;

interface DashboardStats {
  totalBots: number;
  totalUsers: number;
  totalMessages: number;
  totalLeads: number;
}

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalBots: 0,
    totalUsers: 0,
    totalMessages: 0,
    totalLeads: 0,
  });

  const { data: bots, isLoading } = useQuery("bots", botsService.getBots);

  useEffect(() => {
    if (bots) {
      const totalUsers = bots.reduce((sum, bot) => sum + bot.totalUsers, 0);
      const totalMessages = bots.reduce(
        (sum, bot) => sum + bot.totalMessages,
        0
      );
      const totalLeads = bots.reduce((sum, bot) => sum + bot.totalLeads, 0);

      setStats({
        totalBots: bots.length,
        totalUsers,
        totalMessages,
        totalLeads,
      });
    }
  }, [bots]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Дашборд
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Всего ботов"
              value={stats.totalBots}
              prefix={<RobotOutlined style={{ color: "#1890ff" }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Пользователи"
              value={stats.totalUsers}
              prefix={<UserOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Сообщения"
              value={stats.totalMessages}
              prefix={<MessageOutlined style={{ color: "#faad14" }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Заявки"
              value={stats.totalLeads}
              prefix={<FileTextOutlined style={{ color: "#f5222d" }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: "24px" }}>
        <Col xs={24} lg={12}>
          <Card title="Последние боты" hoverable>
            {bots && bots.length > 0 ? (
              <div>
                {bots.slice(0, 5).map((bot) => (
                  <div
                    key={bot.id}
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f0f0f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{bot.name}</div>
                      <div style={{ color: "#666", fontSize: "12px" }}>
                        @{bot.username}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        backgroundColor:
                          bot.status === "active" ? "#f6ffed" : "#fff2e8",
                        color: bot.status === "active" ? "#52c41a" : "#faad14",
                      }}
                    >
                      {bot.status === "active" ? "Активен" : "Неактивен"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{ textAlign: "center", color: "#999", padding: "20px" }}
              >
                У вас пока нет ботов
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Статистика активности" hoverable>
            <div
              style={{ textAlign: "center", color: "#999", padding: "20px" }}
            >
              График активности будет здесь
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
