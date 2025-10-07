import React from "react";
import { Space, Button, Typography, message } from "antd";
import {
  SaveOutlined,
  PlayCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  UploadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { FlowData } from "@/types/flow";

const { Text } = Typography;

interface FlowToolbarProps {
  onSave: () => void;
  onTest: () => void;
  onClear: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onPreview?: () => void;
}

export const FlowToolbar: React.FC<FlowToolbarProps> = ({
  onSave,
  onTest,
  onClear,
  onExport,
  onImport,
  onPreview,
}) => {
  const handleSave = () => {
    onSave();
  };

  const handleTest = () => {
    onTest();
    message.info("Тестирование запущено");
  };

  const handleClear = () => {
    onClear();
    message.info("Диалог очищен");
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
      message.success("Диалог экспортирован");
    }
  };

  const handleImport = () => {
    if (onImport) {
      onImport();
      message.success("Диалог импортирован");
    }
  };

  const handlePreview = () => {
    if (onPreview) {
      onPreview();
      message.info("Предварительный просмотр");
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 10,
        backgroundColor: "white",
        padding: "8px 16px",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #f0f0f0",
      }}
    >
      <Space>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
          Сохранить
        </Button>

        <Button
          icon={<PlayCircleOutlined />}
          onClick={handleTest}
          disabled
          title="Функция в разработке"
        >
          Тест
        </Button>

        <Button
          icon={<EyeOutlined />}
          onClick={handlePreview}
          disabled
          title="Функция в разработке"
        >
          Превью
        </Button>

        <Button icon={<ClearOutlined />} onClick={handleClear}>
          Очистить
        </Button>

        {onExport && (
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Экспорт
          </Button>
        )}

        {onImport && (
          <Button icon={<UploadOutlined />} onClick={handleImport}>
            Импорт
          </Button>
        )}
      </Space>
    </div>
  );
};
