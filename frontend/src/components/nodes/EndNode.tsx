import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Typography, Space } from "antd";
import { StopOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const EndNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { label, reason } = data;

  return (
    <Card
      size="small"
      style={{
        minWidth: 150,
        maxWidth: 200,
        border: selected ? "2px solid #ff4d4f" : "1px solid #ff4d4f",
        borderRadius: 8,
        backgroundColor: selected ? "#fff2f0" : "#fff2f0",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#ff4d4f" }}
      />

      <Space
        direction="vertical"
        style={{ width: "100%", textAlign: "center" }}
      >
        <StopOutlined style={{ fontSize: 24, color: "#ff4d4f" }} />
        <Text strong style={{ color: "#ff4d4f" }}>
          {label}
        </Text>
        {reason && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {reason}
          </Text>
        )}
      </Space>
    </Card>
  );
};
