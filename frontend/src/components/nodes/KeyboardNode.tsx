import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Typography, Space, Button } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const KeyboardNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { label, buttons = [], isInline } = data;

  return (
    <Card
      size="small"
      style={{
        minWidth: 200,
        maxWidth: 300,
        border: selected ? "2px solid #52c41a" : "1px solid #d9d9d9",
        borderRadius: 8,
        backgroundColor: selected ? "#f6ffed" : "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />

      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <AppstoreOutlined style={{ color: "#52c41a" }} />
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
          {buttons.length > 0 ? (
            <Space wrap>
              {buttons.slice(0, 3).map((button: any, index: number) => (
                <Button
                  key={index}
                  size="small"
                  style={{ fontSize: 10, height: 24 }}
                >
                  {button.text}
                </Button>
              ))}
              {buttons.length > 3 && (
                <Text type="secondary" style={{ fontSize: 10 }}>
                  +{buttons.length - 3} еще
                </Text>
              )}
            </Space>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Кнопки не заданы
            </Text>
          )}
        </div>

        <Text type="secondary" style={{ fontSize: 10 }}>
          {isInline ? "Inline" : "Reply"} клавиатура
        </Text>
      </Space>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555" }}
      />
    </Card>
  );
};
