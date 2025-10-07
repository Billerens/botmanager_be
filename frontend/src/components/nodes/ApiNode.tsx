import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Typography, Space, Tag } from "antd";
import { ApiOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const ApiNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { label, url, method, responseMapping } = data;

  const getMethodColor = (method: string) => {
    const colors = {
      GET: "green",
      POST: "blue",
      PUT: "orange",
      DELETE: "red",
    };
    return colors[method as keyof typeof colors] || "default";
  };

  return (
    <Card
      size="small"
      style={{
        minWidth: 200,
        maxWidth: 300,
        border: selected ? "2px solid #722ed1" : "1px solid #d9d9d9",
        borderRadius: 8,
        backgroundColor: selected ? "#f9f0ff" : "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />

      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <ApiOutlined style={{ color: "#722ed1" }} />
          <Text strong>{label}</Text>
        </Space>

        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: 8,
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <div>
              <Tag color={getMethodColor(method)} size="small">
                {method || "GET"}
              </Tag>
              <Text code style={{ fontSize: 10, marginLeft: 4 }}>
                {url ? url.substring(0, 30) + "..." : "URL не задан"}
              </Text>
            </div>
            {responseMapping && (
              <Text type="secondary" style={{ fontSize: 10 }}>
                → {responseMapping}
              </Text>
            )}
          </Space>
        </div>
      </Space>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555" }}
      />
    </Card>
  );
};
