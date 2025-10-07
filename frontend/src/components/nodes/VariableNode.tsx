import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Input, Select, Space } from "antd";
import { DatabaseOutlined } from "@ant-design/icons";
import { FlowNodeData } from "@/types/flow";

const { Option } = Select;

export const VariableNode: React.FC<NodeProps<FlowNodeData>> = ({
  data,
  selected,
}) => {
  return (
    <Card
      size="small"
      style={{
        width: 280,
        border: selected ? "2px solid #1890ff" : "1px solid #d9d9d9",
        borderRadius: 8,
      }}
      title={
        <Space>
          <DatabaseOutlined />
          <span>Переменная</span>
        </Space>
      }
    >
      <Handle type="target" position={Position.Top} />

      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          <label>Имя переменной:</label>
          <Input
            placeholder="myVariable"
            value={data.variable?.name || ""}
            onChange={(e) => {
              data.variable = {
                ...data.variable,
                name: e.target.value,
                value: data.variable?.value || "",
                operation: data.variable?.operation || "set",
                scope: data.variable?.scope || "session",
              };
            }}
            style={{ marginTop: 4 }}
          />
        </div>

        <div>
          <label>Значение:</label>
          <Input
            placeholder="Значение переменной"
            value={data.variable?.value || ""}
            onChange={(e) => {
              data.variable = {
                ...data.variable,
                name: data.variable?.name || "",
                value: e.target.value,
                operation: data.variable?.operation || "set",
                scope: data.variable?.scope || "session",
              };
            }}
            style={{ marginTop: 4 }}
          />
        </div>

        <div>
          <label>Операция:</label>
          <Select
            value={data.variable?.operation || "set"}
            onChange={(value) => {
              data.variable = {
                ...data.variable,
                name: data.variable?.name || "",
                value: data.variable?.value || "",
                operation: value,
                scope: data.variable?.scope || "session",
              };
            }}
            style={{ width: "100%" }}
          >
            <Option value="set">Установить</Option>
            <Option value="append">Добавить в конец</Option>
            <Option value="prepend">Добавить в начало</Option>
            <Option value="increment">Увеличить на 1</Option>
            <Option value="decrement">Уменьшить на 1</Option>
          </Select>
        </div>

        <div>
          <label>Область видимости:</label>
          <Select
            value={data.variable?.scope || "session"}
            onChange={(value) => {
              data.variable = {
                ...data.variable,
                name: data.variable?.name || "",
                value: data.variable?.value || "",
                operation: data.variable?.operation || "set",
                scope: value,
              };
            }}
            style={{ width: "100%" }}
          >
            <Option value="session">Сессия</Option>
            <Option value="user">Пользователь</Option>
            <Option value="global">Глобальная</Option>
          </Select>
        </div>
      </Space>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
