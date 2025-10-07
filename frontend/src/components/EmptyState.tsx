import React from "react";
import { Button, Typography, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

interface EmptyStateProps {
  title: string;
  description: string;
  actionText: string;
  onAction: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 24px",
        background: "#fafafa",
        borderRadius: "8px",
        border: "1px dashed #d9d9d9",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        {icon || <PlusOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />}
      </div>
      <Title level={4} style={{ color: "#999", marginBottom: "16px" }}>
        {title}
      </Title>
      <Paragraph style={{ color: "#999", marginBottom: "24px" }}>
        {description}
      </Paragraph>
      <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
        {actionText}
      </Button>
    </div>
  );
};
