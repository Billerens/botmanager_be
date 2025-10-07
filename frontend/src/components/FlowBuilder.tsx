import React, { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { FlowSidebar } from "./FlowSidebar";
import { FlowToolbar } from "./FlowToolbar";
import { MessageNode } from "./nodes/MessageNode";
import { KeyboardNode } from "./nodes/KeyboardNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ApiNode } from "./nodes/ApiNode";
import { StartNode } from "./nodes/StartNode";
import { EndNode } from "./nodes/EndNode";
import { FormNode } from "./nodes/FormNode";
import { DelayNode } from "./nodes/DelayNode";
import { VariableNode } from "./nodes/VariableNode";
import { FileNode } from "./nodes/FileNode";
import { RandomNode } from "./nodes/RandomNode";

import { FlowData, FlowNodeData, FlowNodeType } from "@/types/flow";

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  keyboard: KeyboardNode,
  condition: ConditionNode,
  api: ApiNode,
  end: EndNode,
  form: FormNode,
  delay: DelayNode,
  variable: VariableNode,
  file: FileNode,
  random: RandomNode,
};

const initialNodes: Node[] = [
  {
    id: "start",
    type: "start",
    position: { x: 250, y: 50 },
    data: { label: "Начало диалога" },
  },
];

const initialEdges: Edge[] = [];

interface FlowBuilderProps {
  botId: string;
  flowData?: FlowData;
  onSave?: (flowData: FlowData) => void;
  onTest?: (flowData: FlowData) => void;
}

export const FlowBuilder: React.FC<FlowBuilderProps> = ({
  flowData,
  onSave,
  onTest,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    flowData?.nodes || initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    flowData?.edges || initialEdges
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: "#b1b1b7",
        },
        style: {
          strokeWidth: 2,
          stroke: "#b1b1b7",
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = useCallback(
    (type: FlowNodeType, position: { x: number; y: number }) => {
      const id = `${type}-${Date.now()}`;
      const newNode: Node = {
        id,
        type,
        position,
        data: {
          label: getDefaultNodeLabel(type),
          ...getDefaultNodeData(type),
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const updateNode = useCallback(
    (nodeId: string, data: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );
      setSelectedNode(null);
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [setNodes, setEdges, selectedNode]
  );

  const currentFlowData: FlowData = useMemo(
    () => ({
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type as FlowNodeType,
        position: node.position,
        data: node.data as FlowNodeData,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || "smoothstep",
      })),
      viewport: { x: 0, y: 0, zoom: 1 }, // TODO: Получать реальный viewport из ReactFlow
    }),
    [nodes, edges]
  );

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(currentFlowData);
    }
  }, [currentFlowData, onSave]);

  const handleTest = useCallback(() => {
    if (onTest) {
      onTest(currentFlowData);
    }
  }, [currentFlowData, onTest]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      <FlowSidebar
        onAddNode={addNode}
        selectedNode={selectedNode}
        onUpdateNode={updateNode}
        onDeleteNode={deleteNode}
      />

      <div style={{ flex: 1, position: "relative" }}>
        <FlowToolbar
          onSave={handleSave}
          onTest={handleTest}
          onClear={() => {
            setNodes(initialNodes);
            setEdges([]);
          }}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeStrokeColor={(n) => {
              if (n.type === "start") return "#52c41a";
              if (n.type === "end") return "#ff4d4f";
              return "#1890ff";
            }}
            nodeColor={(n) => {
              if (n.type === "start") return "#f6ffed";
              if (n.type === "end") return "#fff2f0";
              return "#f0f9ff";
            }}
            style={{
              backgroundColor: "#f8f9fa",
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
};

// Вспомогательные функции
function getDefaultNodeLabel(type: FlowNodeType): string {
  const labels = {
    start: "Начало",
    message: "Сообщение",
    keyboard: "Клавиатура",
    condition: "Условие",
    api: "API запрос",
    end: "Конец",
  };
  return labels[type] || "Узел";
}

function getDefaultNodeData(type: FlowNodeType): Partial<FlowNodeData> {
  switch (type) {
    case "message":
      return {
        text: "Введите текст сообщения...",
        parseMode: "HTML",
      };
    case "keyboard":
      return {
        buttons: [
          { text: "Кнопка 1", callbackData: "btn1" },
          { text: "Кнопка 2", callbackData: "btn2" },
        ],
        isInline: true,
      };
    case "condition":
      return {
        condition: "user.firstName",
        operator: "exists",
        value: "",
        trueLabel: "Да",
        falseLabel: "Нет",
      };
    case "api":
      return {
        url: "https://api.example.com/endpoint",
        method: "POST",
        headers: {},
        body: "{}",
        responseMapping: "response.data",
      };
    case "end":
      return {
        reason: "Диалог завершен",
      };
    case "form":
      return {
        form: {
          fields: [
            {
              id: "field1",
              label: "Имя",
              type: "text",
              required: true,
              placeholder: "Введите ваше имя",
            },
          ],
          submitText: "Отправить",
          successMessage: "Спасибо!",
        },
      };
    case "delay":
      return {
        delay: {
          value: 1,
          unit: "seconds",
        },
      };
    case "variable":
      return {
        variable: {
          name: "myVariable",
          value: "",
          operation: "set",
          scope: "session",
        },
      };
    case "file":
      return {
        file: {
          type: "upload",
          accept: ["image/*", ".pdf"],
          maxSize: 10,
        },
      };
    case "random":
      return {
        random: {
          options: [
            { value: "option1", label: "Вариант 1", weight: 1 },
            { value: "option2", label: "Вариант 2", weight: 1 },
          ],
          variable: "randomResult",
        },
      };
    default:
      return {};
  }
}
