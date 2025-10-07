import React, { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Input, Button, Space, Divider } from "antd";
import {
  QuestionCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { FlowNodeData, RandomOption } from "@/types/flow";

export const RandomNode: React.FC<NodeProps<FlowNodeData>> = ({
  data,
  selected,
}) => {
  const [options, setOptions] = useState<RandomOption[]>(
    data.random?.options || [
      { value: "option1", label: "Вариант 1", weight: 1 },
      { value: "option2", label: "Вариант 2", weight: 1 },
    ]
  );

  const addOption = () => {
    const newOption: RandomOption = {
      value: `option${Date.now()}`,
      label: `Вариант ${options.length + 1}`,
      weight: 1,
    };
    setOptions([...options, newOption]);
    data.random = {
      ...data.random,
      options: [...options, newOption],
      variable: data.random?.variable || "randomResult",
    };
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    data.random = {
      ...data.random,
      options: newOptions,
      variable: data.random?.variable || "randomResult",
    };
  };

  const updateOption = (index: number, updates: Partial<RandomOption>) => {
    const newOptions = options.map((option, i) =>
      i === index ? { ...option, ...updates } : option
    );
    setOptions(newOptions);
    data.random = {
      ...data.random,
      options: newOptions,
      variable: data.random?.variable || "randomResult",
    };
  };

  return (
    <Card
      size="small"
      style={{
        width: 300,
        border: selected ? "2px solid #1890ff" : "1px solid #d9d9d9",
        borderRadius: 8,
      }}
      title={
        <Space>
          <QuestionCircleOutlined />
          <span>Случайный выбор</span>
        </Space>
      }
    >
      <Handle type="target" position={Position.Top} />

      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          <label>Переменная для результата:</label>
          <Input
            placeholder="randomResult"
            value={data.random?.variable || "randomResult"}
            onChange={(e) => {
              data.random = {
                ...data.random,
                options: options,
                variable: e.target.value,
              };
            }}
            style={{ marginTop: 4 }}
          />
        </div>

        <Divider style={{ margin: "8px 0" }} />

        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {options.map((option, index) => (
            <Card
              key={index}
              size="small"
              style={{ marginBottom: 8, background: "#fafafa" }}
              title={
                <Space>
                  <span>Вариант {index + 1}</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeOption(index)}
                  />
                </Space>
              }
            >
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="small"
              >
                <div>
                  <label>Значение:</label>
                  <Input
                    value={option.value}
                    onChange={(e) =>
                      updateOption(index, { value: e.target.value })
                    }
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div>
                  <label>Название:</label>
                  <Input
                    value={option.label || ""}
                    onChange={(e) =>
                      updateOption(index, { label: e.target.value })
                    }
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div>
                  <label>Вес (вероятность):</label>
                  <Input
                    type="number"
                    min={1}
                    value={option.weight || 1}
                    onChange={(e) =>
                      updateOption(index, {
                        weight: parseInt(e.target.value) || 1,
                      })
                    }
                    style={{ marginTop: 4 }}
                  />
                </div>
              </Space>
            </Card>
          ))}
        </div>

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addOption}
          style={{ width: "100%" }}
        >
          Добавить вариант
        </Button>
      </Space>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
