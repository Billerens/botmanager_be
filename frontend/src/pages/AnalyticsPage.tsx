import React from "react";
import { Card, Typography, Row, Col, Statistic } from "antd";
import {
  UserOutlined,
  MessageOutlined,
  FileTextOutlined,
} from "@ant-design/icons";

const { Title } = Typography;

export const AnalyticsPage: React.FC = () => {
  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Аналитика
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Новые пользователи"
              value={1128}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Сообщения"
              value={9324}
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Заявки"
              value={156}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: "24px" }}>
        <Title level={4}>Графики будут здесь</Title>
        <p>Здесь будут отображаться графики и диаграммы</p>
      </Card>
    </div>
  );
};
