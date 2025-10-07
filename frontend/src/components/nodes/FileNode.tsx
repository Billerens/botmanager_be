import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, Select, Input, Space, InputNumber } from "antd";
import { FileOutlined } from "@ant-design/icons";
import { FlowNodeData } from "@/types/flow";

const { Option } = Select;

export const FileNode: React.FC<NodeProps<FlowNodeData>> = ({
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
          <FileOutlined />
          <span>Работа с файлами</span>
        </Space>
      }
    >
      <Handle type="target" position={Position.Top} />

      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          <label>Тип операции:</label>
          <Select
            value={data.file?.type || "upload"}
            onChange={(value) => {
              data.file = {
                ...data.file,
                type: value,
                accept: data.file?.accept || [],
                maxSize: data.file?.maxSize || 10,
                url: data.file?.url || "",
                filename: data.file?.filename || "",
              };
            }}
            style={{ width: "100%" }}
          >
            <Option value="upload">Загрузка файла</Option>
            <Option value="download">Скачивание файла</Option>
            <Option value="send">Отправка файла</Option>
          </Select>
        </div>

        {data.file?.type === "upload" && (
          <>
            <div>
              <label>Разрешенные типы файлов:</label>
              <Input
                placeholder="image/*, .pdf, .doc"
                value={data.file?.accept?.join(", ") || ""}
                onChange={(e) => {
                  data.file = {
                    ...data.file,
                    type: data.file?.type || "upload",
                    accept: e.target.value.split(",").map((s) => s.trim()),
                    maxSize: data.file?.maxSize || 10,
                    url: data.file?.url || "",
                    filename: data.file?.filename || "",
                  };
                }}
                style={{ marginTop: 4 }}
              />
            </div>

            <div>
              <label>Максимальный размер (МБ):</label>
              <InputNumber
                min={1}
                max={100}
                value={data.file?.maxSize || 10}
                onChange={(value) => {
                  data.file = {
                    ...data.file,
                    type: data.file?.type || "upload",
                    accept: data.file?.accept || [],
                    maxSize: value || 10,
                    url: data.file?.url || "",
                    filename: data.file?.filename || "",
                  };
                }}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
          </>
        )}

        {(data.file?.type === "download" || data.file?.type === "send") && (
          <div>
            <label>URL файла:</label>
            <Input
              placeholder="https://example.com/file.pdf"
              value={data.file?.url || ""}
              onChange={(e) => {
                data.file = {
                  ...data.file,
                  type: data.file?.type || "download",
                  accept: data.file?.accept || [],
                  maxSize: data.file?.maxSize || 10,
                  url: e.target.value,
                  filename: data.file?.filename || "",
                };
              }}
              style={{ marginTop: 4 }}
            />
          </div>
        )}

        <div>
          <label>Имя файла (опционально):</label>
          <Input
            placeholder="document.pdf"
            value={data.file?.filename || ""}
            onChange={(e) => {
              data.file = {
                ...data.file,
                type: data.file?.type || "upload",
                accept: data.file?.accept || [],
                maxSize: data.file?.maxSize || 10,
                url: data.file?.url || "",
                filename: e.target.value,
              };
            }}
            style={{ marginTop: 4 }}
          />
        </div>
      </Space>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
