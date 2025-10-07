import React, { useState } from "react";
import {
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Select,
  Input,
  Tooltip,
  Avatar,
  message,
} from "antd";
import {
  MessageOutlined,
  UserOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { useQuery } from "react-query";
import {
  messagesService,
  Message,
  MessageFilters,
} from "@/services/messagesService";

const { Text, Title } = Typography;
const { Option } = Select;
const { Search } = Input;

interface MessagesTableProps {
  botId: string;
  onMessageClick: (message: Message) => void;
}

export const MessagesTable: React.FC<MessagesTableProps> = ({
  botId,
  onMessageClick,
}) => {
  const [filters, setFilters] = useState<MessageFilters>({
    page: 1,
    limit: 20,
    type: undefined,
  });
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, error } = useQuery(
    ["messages", botId, filters],
    () => messagesService.getBotMessages(botId, filters),
    {
      keepPreviousData: true,
    }
  );

  const handleTypeFilter = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      type: type === "all" ? undefined : (type as "incoming" | "outgoing"),
      page: 1,
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    // Здесь можно добавить поиск по тексту сообщений
  };

  const getMessageTypeTag = (type: string) => {
    const isIncoming = type === "incoming";
    return (
      <Tag
        color={isIncoming ? "blue" : "green"}
        icon={isIncoming ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
      >
        {isIncoming ? "Входящее" : "Исходящее"}
      </Tag>
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

  const formatMessageText = (message: Message) => {
    if (message.text) {
      return message.text.length > 100
        ? `${message.text.substring(0, 100)}...`
        : message.text;
    }

    if (message.media) {
      return `${getContentTypeIcon(message.contentType)} Медиафайл`;
    }

    return "Сообщение без текста";
  };

  const columns = [
    {
      title: "Тип",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => getMessageTypeTag(type),
    },
    {
      title: "Пользователь",
      dataIndex: "metadata",
      key: "user",
      width: 200,
      render: (metadata: any) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div>
              {metadata?.firstName && metadata?.lastName
                ? `${metadata.firstName} ${metadata.lastName}`
                : metadata?.username || "Неизвестный пользователь"}
            </div>
            {metadata?.username && (
              <Text type="secondary" style={{ fontSize: "12px" }}>
                @{metadata.username}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: "Сообщение",
      dataIndex: "text",
      key: "message",
      render: (text: string, record: Message) => (
        <div style={{ maxWidth: 300 }}>
          <Text>{formatMessageText(record)}</Text>
          {record.keyboard && record.keyboard.buttons.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <Tag size="small" color="purple">
                Клавиатура ({record.keyboard.buttons.length})
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Время",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => (
        <Text type="secondary">
          {new Date(date).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      ),
    },
    {
      title: "Статус",
      dataIndex: "isProcessed",
      key: "status",
      width: 100,
      render: (isProcessed: boolean, record: Message) => (
        <Space direction="vertical" size="small">
          <Tag color={isProcessed ? "green" : "orange"}>
            {isProcessed ? "Обработано" : "В очереди"}
          </Tag>
          {record.errorMessage && (
            <Tooltip title={record.errorMessage}>
              <Tag color="red" size="small">
                Ошибка
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Действия",
      key: "actions",
      width: 100,
      render: (_, record: Message) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => onMessageClick(record)}
          size="small"
        >
          Диалог
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <Text type="danger">Ошибка загрузки сообщений</Text>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Title level={5} style={{ margin: 0 }}>
            <MessageOutlined /> История сообщений
          </Title>
          <Select
            value={filters.type || "all"}
            onChange={handleTypeFilter}
            style={{ width: 150 }}
            placeholder="Тип сообщения"
          >
            <Option value="all">Все сообщения</Option>
            <Option value="incoming">Входящие</Option>
            <Option value="outgoing">Исходящие</Option>
          </Select>
          <Search
            placeholder="Поиск по тексту..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data?.messages || []}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: filters.page,
          pageSize: filters.limit,
          total: data?.pagination?.total || 0,
          onChange: handlePageChange,
          showSizeChanger: false,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} из ${total} сообщений`,
        }}
        scroll={{ x: 800 }}
        size="small"
      />
    </div>
  );
};
