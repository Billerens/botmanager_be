import React from "react";
import { Card, Typography, Table, Tag, Space, Button } from "antd";
import { EyeOutlined, EditOutlined } from "@ant-design/icons";

const { Title } = Typography;

export const LeadsPage: React.FC = () => {
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
    },
    {
      title: "Имя",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "new" ? "blue" : "green"}>
          {status === "new" ? "Новая" : "Обработана"}
        </Tag>
      ),
    },
    {
      title: "Дата",
      dataIndex: "date",
      key: "date",
    },
    {
      title: "Действия",
      key: "actions",
      render: () => (
        <Space>
          <Button type="text" icon={<EyeOutlined />} />
          <Button type="text" icon={<EditOutlined />} />
        </Space>
      ),
    },
  ];

  const data = [
    {
      key: "1",
      id: "1",
      name: "Иван Петров",
      email: "ivan@example.com",
      status: "new",
      date: "2023-12-01",
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Заявки
      </Title>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};
