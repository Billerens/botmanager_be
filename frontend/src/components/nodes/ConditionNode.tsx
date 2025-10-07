import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Typography, Space, Tag } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const ConditionNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { label, condition, operator, value, trueLabel, falseLabel } = data;

  const getOperatorText = (op: string) => {
    const operators = {
      equals: "=",
      not_equals: "≠",
      exists: "существует",
      not_exists: "не существует",
      contains: "содержит",
      not_contains: "не содержит",
    };
    return operators[op as keyof typeof operators] || op;
  };

  return (
    <Card
      size="small"
      style={{
        minWidth: 200,
        maxWidth: 300,
        border: selected ? "2px solid #faad14" : "1px solid #d9d9d9",
        borderRadius: 8,
        backgroundColor: selected ? "#fffbe6" : "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />

      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <QuestionCircleOutlined style={{ color: "#faad14" }} />
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
          <Text code style={{ fontSize: 11 }}>
            {condition || "поле"}
          </Text>
          <Text style={{ margin: "0 4px", fontSize: 11 }}>
            {getOperatorText(operator)}
          </Text>
          {value && (
            <Text code style={{ fontSize: 11 }}>
              "{value}"
            </Text>
          )}
        </div>

        <Space size="small">
          <Tag size="small" color="green">
            {trueLabel || "Да"}
          </Tag>
          <Tag size="small" color="red">
            {falseLabel || "Нет"}
          </Tag>
        </Space>
      </Space>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ background: "#52c41a", left: "25%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ background: "#ff4d4f", left: "75%" }}
      />
    </Card>
  );
};
