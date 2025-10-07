import React, { useState } from "react";
import {
  Card,
  Typography,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Tag,
  Tabs,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tooltip,
  Alert,
  Descriptions,
  Badge,
} from "antd";
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
  MessageOutlined,
  UserOutlined,
  BarChartOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { botsService } from "@/services/botsService";
import { MessagesTable } from "@/components/MessagesTable";
import { DialogModal } from "@/components/DialogModal";
import { FlowBuilder } from "@/components/FlowBuilder";
import { Message } from "@/services/messagesService";
import { FlowData } from "@/types/flow";
import {
  flowsService,
  BotFlow,
  getFlowIsActive,
} from "@/services/flowsService";

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

export const BotDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDialogModalVisible, setIsDialogModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showFlowBuilder, setShowFlowBuilder] = useState(false);
  const [currentFlow, setCurrentFlow] = useState<BotFlow | null>(null);
  const [form] = Form.useForm();

  const { data: bot, isLoading } = useQuery(
    ["bot", id],
    () => botsService.getBot(id!),
    { enabled: !!id }
  );

  const { data: stats } = useQuery(
    ["bot-stats", id],
    () => botsService.getBotStats(id!),
    { enabled: !!id }
  );

  const { data: flows } = useQuery(
    ["bot-flows", id],
    () => flowsService.getFlows(id!),
    { enabled: !!id }
  );

  const updateBotMutation = useMutation(
    (data: { name?: string; description?: string }) =>
      botsService.updateBot(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bot", id]);
        setIsEditModalVisible(false);
        form.resetFields();
        message.success("Бот успешно обновлен");
      },
    }
  );

  const deleteBotMutation = useMutation(() => botsService.deleteBot(id!), {
    onSuccess: () => {
      queryClient.invalidateQueries("bots");
      message.success("Бот успешно удален");
      navigate("/bots");
    },
  });

  const activateBotMutation = useMutation(() => botsService.activateBot(id!), {
    onSuccess: () => {
      queryClient.invalidateQueries(["bot", id]);
      message.success("Бот активирован");
    },
  });

  const deactivateBotMutation = useMutation(
    () => botsService.deactivateBot(id!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bot", id]);
        message.success("Бот деактивирован");
      },
    }
  );

  const createFlowMutation = useMutation(
    (data: { name: string; description?: string; flowData: FlowData }) =>
      flowsService.createFlow(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bot-flows", id]);
        message.success("Диалог создан");
      },
    }
  );

  const updateFlowMutation = useMutation(
    ({
      flowId,
      data,
    }: {
      flowId: string;
      data: { name?: string; description?: string; flowData?: FlowData };
    }) => flowsService.updateFlow(id!, flowId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bot-flows", id]);
        message.success("Диалог обновлен");
      },
    }
  );

  const deleteFlowMutation = useMutation(
    (flowId: string) => flowsService.deleteFlow(id!, flowId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bot-flows", id]);
        message.success("Диалог удален");
      },
    }
  );

  const activateFlowMutation = useMutation(
    (flowId: string) => flowsService.activateFlow(id!, flowId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bot-flows", id]);
        message.success("Диалог активирован");
      },
    }
  );

  const deactivateFlowMutation = useMutation(
    (flowId: string) => flowsService.deactivateFlow(id!, flowId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bot-flows", id]);
        message.success("Диалог деактивирован");
      },
    }
  );

  const handleEdit = () => {
    if (bot) {
      form.setFieldsValue({
        name: bot.name,
        description: bot.description,
      });
      setIsEditModalVisible(true);
    }
  };

  const handleEditOk = () => {
    form.validateFields().then((values) => {
      updateBotMutation.mutate(values);
    });
  };

  const handleToggleBot = () => {
    if (bot?.status === "active") {
      deactivateBotMutation.mutate();
    } else {
      activateBotMutation.mutate();
    }
  };

  const handleDeleteBot = () => {
    deleteBotMutation.mutate();
  };

  const handleMessageClick = (message: Message) => {
    setSelectedMessage(message);
    setIsDialogModalVisible(true);
  };

  const handleCloseDialog = () => {
    setIsDialogModalVisible(false);
    setSelectedMessage(null);
  };

  const handleSaveFlow = (flowData: FlowData) => {
    if (currentFlow) {
      // Обновляем существующий flow
      updateFlowMutation.mutate({
        flowId: currentFlow.id,
        data: { flowData },
      });
    } else {
      // Создаем новый flow
      const flowName = prompt("Введите название диалога:");
      if (flowName) {
        createFlowMutation.mutate({
          name: flowName,
          flowData,
        });
      }
    }
  };

  const handleTestFlow = (flowData: FlowData) => {
    console.log("Testing flow:", flowData);
    // TODO: Implement flow testing
    message.info("Тестирование диалога запущено");
  };

  const handleCreateFlow = () => {
    setCurrentFlow(null);
    setShowFlowBuilder(true);
  };

  const handleEditFlow = (flow: BotFlow) => {
    setCurrentFlow(flow);
    setShowFlowBuilder(true);
  };

  const handleToggleFlow = (flow: BotFlow) => {
    if (getFlowIsActive(flow)) {
      // Деактивируем flow
      deactivateFlowMutation.mutate(flow.id);
    } else {
      // Активируем flow
      activateFlowMutation.mutate(flow.id);
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

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  if (!bot) {
    return <div>Бот не найден</div>;
  }

  return (
    <div>
      <Space style={{ marginBottom: "24px" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/bots")}>
          Назад к ботам
        </Button>
      </Space>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {bot.name}
          </Title>
          <Paragraph style={{ margin: 0, color: "#666" }}>
            @{bot.username}
          </Paragraph>
        </div>
        <Space>
          <Tooltip
            title={bot.status === "active" ? "Деактивировать" : "Активировать"}
          >
            <Button
              icon={
                bot.status === "active" ? (
                  <PauseCircleOutlined />
                ) : (
                  <PlayCircleOutlined />
                )
              }
              onClick={handleToggleBot}
              loading={
                activateBotMutation.isLoading || deactivateBotMutation.isLoading
              }
            >
              {bot.status === "active" ? "Деактивировать" : "Активировать"}
            </Button>
          </Tooltip>
          <Button icon={<EditOutlined />} onClick={handleEdit}>
            Редактировать
          </Button>
          <Popconfirm
            title="Удалить бота?"
            description="Это действие нельзя отменить"
            onConfirm={handleDeleteBot}
            okText="Да"
            cancelText="Нет"
          >
            <Button danger icon={<DeleteOutlined />}>
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {bot.lastError && (
        <Alert
          message="Ошибка бота"
          description={bot.lastError}
          type="error"
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: "24px" }}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card title="Общая информация">
            <Descriptions column={2}>
              <Descriptions.Item label="Название">{bot.name}</Descriptions.Item>
              <Descriptions.Item label="Username">
                @{bot.username}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                {getStatusTag(bot.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Webhook">
                <Badge
                  status={bot.isWebhookSet ? "success" : "default"}
                  text={bot.isWebhookSet ? "Настроен" : "Не настроен"}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Описание" span={2}>
                {bot.description || "Нет описания"}
              </Descriptions.Item>
              <Descriptions.Item label="Создан">
                {new Date(bot.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Обновлен">
                {new Date(bot.updatedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Статистика">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic
                  title="Пользователи"
                  value={stats?.totalUsers || bot.totalUsers}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Сообщения"
                  value={stats?.totalMessages || bot.totalMessages}
                  prefix={<MessageOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Лиды"
                  value={stats?.totalLeads || bot.totalLeads}
                  prefix={<BarChartOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: "24px" }}>
        <Tabs defaultActiveKey="flows">
          <TabPane tab="Диалоги" key="flows">
            {showFlowBuilder ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => setShowFlowBuilder(false)}
                  >
                    Назад к списку диалогов
                  </Button>
                </div>
                <div
                  style={{ height: "70vh", width: "100%", overflow: "hidden" }}
                >
                  <FlowBuilder
                    botId={id!}
                    flowData={currentFlow?.flowData}
                    onSave={handleSaveFlow}
                    onTest={handleTestFlow}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Title level={4} style={{ margin: 0 }}>
                    Диалоги бота
                  </Title>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateFlow}
                  >
                    Создать диалог
                  </Button>
                </div>

                {flows && flows.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(350px, 1fr))",
                      gap: 20,
                    }}
                  >
                    {flows.map((flow) => (
                      <Card
                        key={flow.id}
                        hoverable
                        style={{
                          borderRadius: 8,
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                        }}
                        bodyStyle={{ padding: "16px 20px" }}
                        actions={[
                          <div
                            key="actions"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 16px",
                              gap: 8,
                            }}
                          >
                            <Button
                              type={
                                getFlowIsActive(flow) ? "default" : "primary"
                              }
                              size="small"
                              icon={
                                getFlowIsActive(flow) ? (
                                  <StopOutlined />
                                ) : (
                                  <PlayCircleOutlined />
                                )
                              }
                              onClick={() => handleToggleFlow(flow)}
                              style={{ flex: 1, maxWidth: 140 }}
                            >
                              {getFlowIsActive(flow)
                                ? "Деактивировать"
                                : "Активировать"}
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleEditFlow(flow)}
                              style={{ flex: 0.8 }}
                            >
                              Редактировать
                            </Button>
                            <Button
                              type="link"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                if (confirm("Удалить диалог?")) {
                                  deleteFlowMutation.mutate(flow.id);
                                }
                              }}
                              style={{ flex: 0.8 }}
                            >
                              Удалить
                            </Button>
                          </div>,
                        ]}
                      >
                        <Card.Meta
                          title={
                            <Space>
                              {flow.name}
                              {getFlowIsActive(flow) && (
                                <Tag color="green">Активен</Tag>
                              )}
                            </Space>
                          }
                          description={flow.description || "Без описания"}
                        />
                        <div
                          style={{ marginTop: 8, fontSize: 12, color: "#999" }}
                        >
                          Создан:{" "}
                          {new Date(flow.createdAt).toLocaleDateString()}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <RobotOutlined
                      style={{ fontSize: "48px", color: "#d9d9d9" }}
                    />
                    <Title level={4} style={{ color: "#999" }}>
                      Нет диалогов
                    </Title>
                    <Paragraph style={{ color: "#999" }}>
                      Создайте первый диалог для вашего бота
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreateFlow}
                    >
                      Создать диалог
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabPane>
          <TabPane tab="Сообщения" key="messages">
            {id && (
              <MessagesTable botId={id} onMessageClick={handleMessageClick} />
            )}
          </TabPane>
          <TabPane tab="Лиды" key="leads">
            <div style={{ textAlign: "center", padding: "40px" }}>
              <UserOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />
              <Title level={4} style={{ color: "#999" }}>
                Собранные лиды
              </Title>
              <Paragraph style={{ color: "#999" }}>
                Здесь будет таблица с собранными лидами
              </Paragraph>
            </div>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="Редактировать бота"
        open={isEditModalVisible}
        onOk={handleEditOk}
        onCancel={() => {
          setIsEditModalVisible(false);
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

      {selectedMessage && (
        <DialogModal
          visible={isDialogModalVisible}
          onClose={handleCloseDialog}
          botId={id!}
          chatId={selectedMessage.telegramChatId}
          userInfo={selectedMessage.metadata}
        />
      )}
    </div>
  );
};
