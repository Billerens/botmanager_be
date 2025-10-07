import React, { useState } from "react";
import {
  Modal,
  List,
  Avatar,
  Typography,
  Space,
  Tag,
  Button,
  Spin,
  Empty,
  Card,
  Divider,
} from "antd";
import {
  UserOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useQuery } from "react-query";
import { messagesService, Message } from "@/services/messagesService";

const { Text, Title } = Typography;

interface DialogModalProps {
  visible: boolean;
  onClose: () => void;
  botId: string;
  chatId: string;
  userInfo?: {
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isBot?: boolean;
  };
}

export const DialogModal: React.FC<DialogModalProps> = ({
  visible,
  onClose,
  botId,
  chatId,
  userInfo,
}) => {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading, error } = useQuery(
    ["dialog", botId, chatId, page],
    () => messagesService.getDialog(botId, chatId, { page, limit }),
    {
      enabled: visible && !!botId && !!chatId,
      keepPreviousData: true,
    }
  );

  const getMessageTypeIcon = (type: string) => {
    return type === "incoming" ? (
      <ArrowDownOutlined style={{ color: "#1890ff" }} />
    ) : (
      <ArrowUpOutlined style={{ color: "#52c41a" }} />
    );
  };

  const getContentTypeIcon = (contentType: string) => {
    const iconMap = {
      text: "💬",
      photo: "📷",
      video: "🎥",
      audio: "🎵",
      document: "📄",
      sticker: "😀",
      voice: "🎤",
      location: "📍",
      contact: "👤",
    };
    return iconMap[contentType as keyof typeof iconMap] || "💬";
  };

  const formatMessageContent = (message: Message) => {
    if (message.text) {
      return message.text;
    }

    if (message.media) {
      return `${getContentTypeIcon(message.contentType)} Медиафайл`;
    }

    return "Сообщение без текста";
  };

  const renderMessage = (message: Message) => {
    const isIncoming = message.type === "incoming";

    return (
      <div
        key={message.id}
        style={{
          display: "flex",
          justifyContent: isIncoming ? "flex-start" : "flex-end",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            maxWidth: "70%",
            backgroundColor: isIncoming ? "#f5f5f5" : "#1890ff",
            color: isIncoming ? "#000" : "#fff",
            padding: "8px 12px",
            borderRadius: "12px",
            position: "relative",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 4 }}
          >
            {getMessageTypeIcon(message.type)}
            <Text
              style={{
                marginLeft: 8,
                fontSize: "12px",
                color: isIncoming ? "#666" : "rgba(255,255,255,0.8)",
              }}
            >
              {new Date(message.createdAt).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </div>

          <div style={{ marginBottom: message.keyboard ? 8 : 0 }}>
            {formatMessageContent(message)}
          </div>

          {message.keyboard && message.keyboard.buttons.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {message.keyboard.buttons.map((button, index) => (
                <Tag
                  key={index}
                  size="small"
                  style={{
                    backgroundColor: isIncoming
                      ? "#fff"
                      : "rgba(255,255,255,0.2)",
                    color: isIncoming ? "#000" : "#fff",
                    border: "none",
                    margin: "2px",
                  }}
                >
                  {button.text}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleLoadMore = () => {
    if (data && page < data.pagination.totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          <span>
            Диалог с{" "}
            {userInfo?.firstName
              ? `${userInfo.firstName}${
                  userInfo.lastName ? ` ${userInfo.lastName}` : ""
                }`
              : userInfo?.username || "пользователем"}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ top: 20 }}
      bodyStyle={{ padding: 0 }}
    >
      {userInfo && (
        <Card size="small" style={{ margin: 16, marginBottom: 0 }}>
          <Space>
            <Avatar icon={<UserOutlined />} />
            <div>
              <div>
                {userInfo.firstName
                  ? `${userInfo.firstName}${
                      userInfo.lastName ? ` ${userInfo.lastName}` : ""
                    }`
                  : userInfo.username || "Неизвестный пользователь"}
              </div>
              {userInfo.username && (
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  @{userInfo.username}
                </Text>
              )}
              {userInfo.languageCode && (
                <Tag size="small" style={{ marginLeft: 8 }}>
                  {userInfo.languageCode.toUpperCase()}
                </Tag>
              )}
            </div>
          </Space>
        </Card>
      )}

      <div style={{ padding: 16, maxHeight: 500, overflowY: "auto" }}>
        {isLoading && !data ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Empty description="Ошибка загрузки диалога" />
        ) : !data?.messages?.length ? (
          <Empty description="Диалог пуст" />
        ) : (
          <>
            {data.messages.map(renderMessage)}

            {data.pagination.totalPages > page && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <Button onClick={handleLoadMore} loading={isLoading}>
                  Загрузить еще
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
