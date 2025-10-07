import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, InputNumber, Select, Space } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { FlowNodeData } from "@/types/flow";

const { Option } = Select;

export const DelayNode: React.FC<NodeProps<FlowNodeData>> = ({
  data,
  selected,
}) => {
  return (
    <Card
      size="small"
      style={{
        width: 250,
        border: selected ? "2px solid #1890ff" : "1px solid #d9d9d9",
        borderRadius: 8,
      }}
      title={
        <Space>
          <ClockCircleOutlined />
          <span>Задержка</span>
        </Space>
      }
    >
      <Handle type="target" position={Position.Top} />

      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          <label>Время задержки:</label>
          <InputNumber
            min={0}
            value={data.delay?.value || 1}
            onChange={(value) => {
              data.delay = {
                ...data.delay,
                value: value || 1,
                unit: data.delay?.unit || "seconds",
              };
            }}
            style={{ width: "100%", marginTop: 4 }}
          />
        </div>

        <div>
          <label>Единица измерения:</label>
          <Select
            value={data.delay?.unit || "seconds"}
            onChange={(value) => {
              data.delay = {
                ...data.delay,
                value: data.delay?.value || 1,
                unit: value,
              };
            }}
            style={{ width: "100%" }}
          >
            <Option value="seconds">Секунды</Option>
            <Option value="minutes">Минуты</Option>
            <Option value="hours">Часы</Option>
            <Option value="days">Дни</Option>
          </Select>
        </div>
      </Space>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
