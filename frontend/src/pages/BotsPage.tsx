import React, { useState } from "react";
import {
  Card,
  Button,
  Table,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import { botsService, Bot } from "@/services/botsService";
import { CreateBotModal } from "@/components/CreateBotModal";
import { EmptyState } from "@/components/EmptyState";

const { Title } = Typography;

interface CreateBotForm {
  name: string;
  description?: string;
  token: string;
}

export const BotsPage: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: bots, isLoading } = useQuery("bots", botsService.getBots);

  const createBotMutation = useMutation(botsService.createBot, {
    onSuccess: () => {
      queryClient.invalidateQueries("bots");
      setIsModalVisible(false);
      form.resetFields();
      message.success("Бот успешно создан");
    },
  });

  const updateBotMutation = useMutation(
    ({ id, data }: { id: string; data: any }) =>
      botsService.updateBot(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries("bots");
        setIsModalVisible(false);
        setEditingBot(null);
        form.resetFields();
        message.success("Бот успешно обновлен");
      },
    }
  );

  const deleteBotMutation = useMutation(botsService.deleteBot, {
    onSuccess: () => {
      queryClient.invalidateQueries("bots");
      message.success("Бот успешно удален");
    },
  });

  const activateBotMutation = useMutation(botsService.activateBot, {
    onSuccess: () => {
      queryClient.invalidateQueries("bots");
      message.success("Бот активирован");
    },
  });

  const deactivateBotMutation = useMutation(botsService.deactivateBot, {
    onSuccess: () => {
      queryClient.invalidateQueries("bots");
      message.success("Бот деактивирован");
    },
  });

  const handleCreateBot = () => {
    setEditingBot(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleEditBot = (bot: Bot) => {
    setEditingBot(bot);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: bot.name,
      description: bot.description,
    });
  };

  const handleEditModalOk = () => {
    form.validateFields().then((values) => {
      if (editingBot) {
        updateBotMutation.mutate({ id: editingBot.id, data: values });
      }
    });
  };

  const handleModalOk = (values: CreateBotForm) => {
    console.log("handleModalOk received values:", values);
    createBotMutation.mutate(values);
  };

  const handleDeleteBot = (id: string) => {
    deleteBotMutation.mutate(id);
  };

  const handleToggleBot = (bot: Bot) => {
    if (bot.status === "active") {
      deactivateBotMutation.mutate(bot.id);
    } else {
      activateBotMutation.mutate(bot.id);
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      active: { color: "green", text: "Активен" },
      inactive: { color: "default", text: "Неактивен" },
      error: { color: "red", text: "Ошибка" },
    };
    const config =
      statusConfig[status as keyof typeof statusConfig] ||
      statusConfig.inactive;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: Bot) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ color: "#666", fontSize: "12px" }}>
            @{record.username}
          </div>
        </div>
      ),
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      render: (text: string) => text || "-",
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "Пользователи",
      dataIndex: "totalUsers",
      key: "totalUsers",
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: "Сообщения",
      dataIndex: "totalMessages",
      key: "totalMessages",
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: "Заявки",
      dataIndex: "totalLeads",
      key: "totalLeads",
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: "Действия",
      key: "actions",
      render: (_: any, record: Bot) => (
        <Space>
          <Tooltip title="Настройки">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate(`/bots/${record.id}`)}
            />
          </Tooltip>
          <Tooltip
            title={
              record.status === "active" ? "Деактивировать" : "Активировать"
            }
          >
            <Button
              type="text"
              icon={
                record.status === "active" ? (
                  <PauseCircleOutlined />
                ) : (
                  <PlayCircleOutlined />
                )
              }
              onClick={() => handleToggleBot(record)}
            />
          </Tooltip>
          <Tooltip title="Редактировать">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditBot(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить бота?"
            description="Это действие нельзя отменить"
            onConfirm={() => handleDeleteBot(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Tooltip title="Удалить">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Боты
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateBot}
        >
          Добавить бота
        </Button>
      </div>

      <Card>
        {!isLoading && (!bots || bots.length === 0) ? (
          <EmptyState
            title="У вас пока нет ботов"
            description="Создайте своего первого Telegram-бота и начните автоматизировать общение с клиентами"
            actionText="Создать первого бота"
            onAction={handleCreateBot}
            icon={
              <RobotOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={bots}
            loading={isLoading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Всего ${total} ботов`,
            }}
          />
        )}
      </Card>

      <CreateBotModal
        visible={isModalVisible && !editingBot}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        onOk={handleModalOk}
        loading={createBotMutation.isLoading}
      />

      <Modal
        title="Редактировать бота"
        open={isModalVisible && !!editingBot}
        onOk={handleEditModalOk}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingBot(null);
          form.resetFields();
        }}
        confirmLoading={updateBotMutation.isLoading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: "Введите название бота" }]}
          >
            <Input placeholder="Название бота" />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea placeholder="Описание бота (необязательно)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
