import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Typography, Space, Tag } from "antd";
import { MessageOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const MessageNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { label, text, parseMode } = data;

  return (
    <Card
      size="small"
      style={{
        minWidth: 200,
        maxWidth: 300,
        border: selected ? "2px solid #1890ff" : "1px solid #d9d9d9",
        borderRadius: 8,
        backgroundColor: selected ? "#f0f9ff" : "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />

      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <MessageOutlined style={{ color: "#1890ff" }} />
          <Text strong>{label}</Text>
        </Space>

        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: 8,
            borderRadius: 4,
            fontSize: 12,
            maxHeight: 60,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {text || "Текст сообщения не задан"}
        </div>

        {parseMode && parseMode !== "Plain" && (
          <Tag size="small" color="blue">
            {parseMode}
          </Tag>
        )}
      </Space>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555" }}
      />
    </Card>
  );
};
