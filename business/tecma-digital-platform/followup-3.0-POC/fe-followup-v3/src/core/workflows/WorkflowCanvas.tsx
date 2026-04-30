/**
 * Canvas visuale per workflow: stati come nodi, transizioni come archi.
 * Usa @xyflow/react con token del design system.
 */
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowStateRow, WorkflowTransitionRow, ApartmentLockType } from "../../types/domain";

const LOCK_LABEL: Record<ApartmentLockType, string> = {
  none: "Nessuno",
  soft: "Blocco temp.",
  hard: "Blocco def.",
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const HORIZONTAL_GAP = 80;

function StateNode(props: NodeProps) {
  const data = props.data as { state: WorkflowStateRow };
  const s = data.state;
  const lock: ApartmentLockType = s.apartmentLock ?? "none";
  return (
    <div
      className="rounded-ui border-2 border-border bg-card px-3 py-2 shadow-sm"
      style={{ minWidth: NODE_WIDTH, minHeight: NODE_HEIGHT }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !border-2 !bg-primary" />
      <div className="font-medium text-foreground text-sm">{s.label}</div>
      <div className="text-xs text-muted-foreground">{s.code}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {s.terminal && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Terminale</span>
        )}
        {lock !== "none" && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {LOCK_LABEL[lock]}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !border-2 !bg-primary" />
    </div>
  );
}

const nodeTypes = { state: StateNode };

function layoutNodes(
  states: WorkflowStateRow[],
  transitions: WorkflowTransitionRow[]
): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...states].sort((a, b) => a.order - b.order);
  const nodes: Node[] = sorted.map((s, i) => ({
    id: s._id,
    type: "state",
    position: { x: i * (NODE_WIDTH + HORIZONTAL_GAP), y: 0 },
    data: { state: s },
  }));

  const edges: Edge[] = transitions.map((t) => ({
    id: t._id,
    source: t.fromStateId,
    target: t.toStateId,
    type: "smoothstep",
    style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
  }));

  return { nodes, edges };
}

export interface WorkflowCanvasProps {
  states: WorkflowStateRow[];
  transitions: WorkflowTransitionRow[];
  className?: string;
}

export const WorkflowCanvas = ({ states, transitions, className }: WorkflowCanvasProps) => {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => layoutNodes(states, transitions),
    [states, transitions]
  );
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className={className} style={{ height: 280 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        className="bg-muted/20 rounded-ui"
      >
        <Background color="hsl(var(--border))" gap={12} />
        <Controls className="!bg-card !border-border !rounded-ui" />
        <MiniMap
          className="!bg-card !border-border !rounded-ui"
          nodeColor="hsl(var(--primary))"
          maskColor="hsl(var(--muted))"
        />
      </ReactFlow>
    </div>
  );
};
