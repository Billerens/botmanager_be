import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Typography, Space } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const StartNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { label } = data;

  return (
    <Card
      size="small"
      style={{
        minWidth: 150,
        maxWidth: 200,
        border: selected ? "2px solid #52c41a" : "1px solid #52c41a",
        borderRadius: 8,
        backgroundColor: selected ? "#f6ffed" : "#f6ffed",
      }}
    >
      <Space
        direction="vertical"
        style={{ width: "100%", textAlign: "center" }}
      >
        <PlayCircleOutlined style={{ fontSize: 24, color: "#52c41a" }} />
        <Text strong style={{ color: "#52c41a" }}>
          {label}
        </Text>
      </Space>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#52c41a" }}
      />
    </Card>
  );
};
