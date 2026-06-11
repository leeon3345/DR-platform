import { useEffect, useMemo, useState } from "react";
import { Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import DownloadPage from "./DownloadPage";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  getSmoothStepPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  approveRecoveryRecommendation,
  executeRecoveryRestore,
  initializeDashboardToken,
  loadDashboardData,
  loadEventHistory,
  loadLatestEvent,
  loadRestoreStatus,
  loadRtoHistory,
  deleteCluster,
} from "./api";

const statusStyles = {
  error: {
    label: "Error",
    text: "Outage",
    badge: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500 shadow-red-500/40",
    icon: "bg-red-500 text-white",
    border: "border-red-200",
    glow: "shadow-red-500/10",
  },
  outage: {
    label: "Outage",
    text: "Outage",
    badge: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500 shadow-red-500/40",
    icon: "bg-red-500 text-white",
    border: "border-red-300",
    glow: "shadow-red-500/20",
  },
  safe: {
    label: "Safe",
    text: "Protected",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500 shadow-emerald-500/40",
    icon: "bg-emerald-500 text-white",
    border: "border-emerald-200",
    glow: "shadow-emerald-500/10",
  },
  warning: {
    label: "Warning",
    text: "Warning",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-400 shadow-amber-400/40",
    icon: "bg-amber-400 text-slate-950",
    border: "border-amber-300",
    glow: "shadow-amber-500/10",
  },
  recovered: {
    label: "Recovered",
    text: "Recovered",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500 shadow-emerald-500/40",
    icon: "bg-emerald-500 text-white",
    border: "border-emerald-300",
    glow: "shadow-emerald-500/10",
  },
  alerting: {
    label: "Alerting",
    text: "Warning",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-400 shadow-amber-400/40",
    icon: "bg-amber-400 text-slate-950",
    border: "border-amber-200",
    glow: "shadow-amber-500/10",
  },
  analyzing: {
    label: "Analyzing",
    text: "Decisioning",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500 shadow-sky-500/40",
    icon: "bg-sky-500 text-white",
    border: "border-sky-200",
    glow: "shadow-sky-500/10",
  },
  processing: {
    label: "Processing",
    text: "Decisioning",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500 shadow-sky-500/40",
    icon: "bg-sky-500 text-white",
    border: "border-sky-300",
    glow: "shadow-sky-500/10",
  },
  restoring: {
    label: "Restore",
    text: "Failover",
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    dot: "bg-violet-500 shadow-violet-500/40",
    icon: "bg-violet-500 text-white",
    border: "border-violet-200",
    glow: "shadow-violet-500/10",
  },
  standby: {
    label: "Standby",
    text: "Ready",
    badge: "bg-slate-50 text-slate-700 ring-slate-200",
    dot: "bg-slate-400 shadow-slate-400/40",
    icon: "bg-slate-500 text-white",
    border: "border-slate-200",
    glow: "shadow-slate-500/10",
  },
};

const clusterScenarios = [
  {
    id: "prod-cloud-main",
    name: "prod-cloud-main",
    provider: "AWS EKS",
    region: "ap-northeast-2",
    environment: "Production",
    status: "Incident",
    statusBadge: "bg-red-50 text-red-700 ring-red-200",
    statusDot: "bg-red-500",
    rto: "12m",
    rpo: "3m",
    impact: "P1",
    updatedAt: "2026-06-06 02:14 KST",
    description: "운영 Cloud K8s에서 control-plane 장애가 발생했고 Edge K3s로 우선 복구가 진행 중입니다.",
    policy: "Tier-1 services first · DNS cutover requires approval",
    decision:
      "`auth-service`, `api-gateway`, `payment-api`를 Edge K3s에 우선 복구하고, 데이터 일관성 검증 후 DNS 전환 승인을 요청합니다.",
    stream: [
      ["02:14:08", "Cloud K8s 장애 이벤트 발생", "bg-red-500"],
      ["02:14:11", "Prometheus가 Webhook Alert 전송", "bg-amber-500"],
      ["02:14:15", "AI Orchestrator가 복구 우선순위 분석", "bg-sky-500"],
      ["02:14:32", "MinIO에서 Velero Restore 데이터 스트리밍", "bg-violet-500"],
      ["02:15:02", "Edge K3s에서 핵심 워크로드 복원 중", "bg-emerald-500"],
    ],
    nodeOverrides: {
      "cloud-k8s": {
        status: "error",
        detail: "kube-apiserver heartbeat lost",
        metrics: [
          ["Region", "ap-northeast-2"],
          ["Health", "0/3 CP ready"],
          ["Impact", "Core traffic down"],
        ],
      },
      prometheus: {
        status: "alerting",
        detail: "Critical trigger is open",
        metrics: [
          ["Signal", "Webhook queued"],
          ["Triggers", "7 active"],
          ["Latency", "2.1 sec"],
        ],
      },
      minio: {
        status: "safe",
        detail: "Latest Velero backup verified",
        metrics: [
          ["Bucket", "velero-prod"],
          ["RPO", "3 min"],
          ["Integrity", "Passed"],
        ],
      },
      "ai-orchestrator": {
        status: "analyzing",
        detail: "Prioritizing Tier-1 services",
        metrics: [
          ["Model", "DR policy v4"],
          ["Confidence", "96%"],
          ["Action", "Restore plan"],
        ],
      },
      "edge-k3s": {
        status: "restoring",
        detail: "Standby cluster accepting restore",
        metrics: [
          ["Nodes", "4 ready"],
          ["Restore", "42%"],
          ["Ingress", "Warming"],
        ],
      },
    },
  },
  {
    id: "finance-core",
    name: "finance-core",
    provider: "Azure AKS",
    region: "korea-central",
    environment: "Production",
    status: "Warning",
    statusBadge: "bg-amber-50 text-amber-800 ring-amber-200",
    statusDot: "bg-amber-500",
    rto: "20m",
    rpo: "5m",
    impact: "P2",
    updatedAt: "2026-06-06 02:09 KST",
    description: "결제 정산 네임스페이스에서 지연이 감지되어 복구 계획을 사전 계산하고 있습니다.",
    policy: "Stateful workloads require backup consistency check",
    decision:
      "`settlement-api`와 `ledger-worker`를 대기 복구 후보로 유지하고, DB 스냅샷 정합성이 확인되면 Edge K3s 복구를 승인합니다.",
    stream: [
      ["02:09:18", "정산 워크로드 latency 경고 발생", "bg-amber-500"],
      ["02:09:24", "Prometheus가 Warning Trigger 수집", "bg-amber-500"],
      ["02:09:35", "AI Orchestrator가 의존성 그래프 분석", "bg-sky-500"],
      ["02:10:02", "MinIO 백업 무결성 확인 완료", "bg-emerald-500"],
      ["02:10:31", "Edge K3s 복구 리소스 예약", "bg-violet-500"],
    ],
    nodeOverrides: {
      "cloud-k8s": {
        status: "alerting",
        detail: "payment namespace latency spike",
        metrics: [
          ["Region", "korea-central"],
          ["Health", "3/3 CP ready"],
          ["Impact", "Settlement delayed"],
        ],
      },
      prometheus: {
        status: "alerting",
        detail: "Latency warning is open",
        metrics: [
          ["Signal", "Trigger active"],
          ["Triggers", "3 active"],
          ["Latency", "4.8 sec"],
        ],
      },
      minio: {
        status: "safe",
        detail: "Backup chain is consistent",
        metrics: [
          ["Bucket", "finance-dr"],
          ["RPO", "5 min"],
          ["Integrity", "Passed"],
        ],
      },
      "ai-orchestrator": {
        status: "analyzing",
        detail: "Checking stateful dependencies",
        metrics: [
          ["Model", "finance policy"],
          ["Confidence", "89%"],
          ["Action", "Standby plan"],
        ],
      },
      "edge-k3s": {
        status: "restoring",
        detail: "Warm standby resources reserved",
        metrics: [
          ["Nodes", "6 ready"],
          ["Restore", "Standby"],
          ["Ingress", "Disabled"],
        ],
      },
    },
  },
  {
    id: "retail-edge-hub",
    name: "retail-edge-hub",
    provider: "GKE",
    region: "asia-northeast3",
    environment: "Retail",
    status: "Protected",
    statusBadge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    statusDot: "bg-emerald-500",
    rto: "18m",
    rpo: "4m",
    impact: "P3",
    updatedAt: "2026-06-06 02:02 KST",
    description: "현재 운영 장애는 없으며, 백업 경로와 Edge 복구 대상이 정상 연결되어 있습니다.",
    policy: "Continuous backup validation · restore drill ready",
    decision:
      "장애 징후가 없어 자동 복구는 보류합니다. 복구 훈련 요청 시 `catalog-api`와 `inventory-cache`를 우선 복원합니다.",
    stream: [
      ["02:02:04", "정기 헬스체크 정상", "bg-emerald-500"],
      ["02:02:16", "Prometheus heartbeat 수신", "bg-emerald-500"],
      ["02:02:41", "MinIO 백업 객체 검증 완료", "bg-emerald-500"],
      ["02:03:09", "AI Orchestrator가 Drill Plan 갱신", "bg-sky-500"],
      ["02:03:30", "Edge K3s 복구 타깃 대기 중", "bg-violet-500"],
    ],
    nodeOverrides: {
      "cloud-k8s": {
        status: "safe",
        detail: "Cluster is serving normally",
        metrics: [
          ["Region", "asia-northeast3"],
          ["Health", "3/3 CP ready"],
          ["Impact", "None"],
        ],
      },
      prometheus: {
        status: "safe",
        detail: "Heartbeat is healthy",
        metrics: [
          ["Signal", "Normal"],
          ["Triggers", "0 active"],
          ["Latency", "1.4 sec"],
        ],
      },
      minio: {
        status: "safe",
        detail: "Backup replication healthy",
        metrics: [
          ["Bucket", "retail-velero"],
          ["RPO", "4 min"],
          ["Integrity", "Passed"],
        ],
      },
      "ai-orchestrator": {
        status: "analyzing",
        detail: "Maintaining drill plan",
        metrics: [
          ["Model", "retail policy"],
          ["Confidence", "94%"],
          ["Action", "Watch mode"],
        ],
      },
      "edge-k3s": {
        status: "safe",
        detail: "Recovery target ready",
        metrics: [
          ["Nodes", "5 ready"],
          ["Restore", "Ready"],
          ["Ingress", "Standby"],
        ],
      },
    },
  },
];

const baseFlowNodes = [
  {
    id: "cloud-k8s",
    type: "drNode",
    position: { x: 40, y: 210 },
    data: {
      icon: "cloud",
      label: "Cloud K8s",
      subtitle: "Primary operational server",
      status: "error",
      detail: "kube-apiserver heartbeat lost",
      metrics: [
        ["Region", "ap-northeast"],
        ["Health", "0/3 CP ready"],
        ["Impact", "Core traffic down"],
      ],
    },
  },
  {
    id: "prometheus",
    type: "drNode",
    position: { x: 430, y: 42 },
    data: {
      icon: "pulse",
      label: "Prometheus",
      subtitle: "Monitoring system",
      status: "alerting",
      detail: "Critical trigger is open",
      metrics: [
        ["Signal", "Webhook queued"],
        ["Triggers", "7 active"],
        ["Latency", "2.1 sec"],
      ],
    },
  },
  {
    id: "minio",
    type: "drNode",
    position: { x: 430, y: 360 },
    data: {
      icon: "database",
      label: "MinIO",
      subtitle: "Backup storage",
      status: "safe",
      detail: "Latest Velero backup verified",
      metrics: [
        ["Bucket", "velero-prod"],
        ["RPO", "3 min"],
        ["Integrity", "Passed"],
      ],
    },
  },
  {
    id: "ai-orchestrator",
    type: "drNode",
    position: { x: 850, y: 92 },
    data: {
      icon: "brain",
      label: "AI Orchestrator",
      subtitle: "Recovery decision engine",
      status: "analyzing",
      detail: "Prioritizing Tier-1 services",
      metrics: [
        ["Model", "DR policy v4"],
        ["Confidence", "96%"],
        ["Action", "Restore plan"],
      ],
    },
  },
  {
    id: "edge-k3s",
    type: "drNode",
    position: { x: 1280, y: 300 },
    data: {
      icon: "edge",
      label: "Edge K3s",
      subtitle: "Recovery target edge cluster",
      status: "restoring",
      detail: "Standby cluster accepting restore",
      metrics: [
        ["Nodes", "4 ready"],
        ["Restore", "42%"],
        ["Ingress", "Warming"],
      ],
    },
  },
];

const flowEdges = [
  {
    id: "cloud-to-prometheus",
    source: "cloud-k8s",
    sourceHandle: "right",
    target: "prometheus",
    targetHandle: "left",
    type: "labeled",
    animated: true,
    label: "Outage event triggered",
    className: "edge-outage",
    data: { labelOffset: { x: -18, y: -34 }, labelTone: "danger" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
    style: { stroke: "#ef4444", strokeWidth: 2.5, strokeDasharray: "8 7" },
  },
  {
    id: "cloud-to-minio",
    source: "cloud-k8s",
    sourceHandle: "right",
    target: "minio",
    targetHandle: "left",
    type: "labeled",
    animated: true,
    label: "Regular backup flow",
    className: "edge-backup",
    data: { labelOffset: { x: -18, y: 34 }, labelTone: "neutral" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
    style: { stroke: "#64748b", strokeWidth: 2.25 },
  },
  {
    id: "prometheus-to-ai",
    source: "prometheus",
    sourceHandle: "right",
    target: "ai-orchestrator",
    targetHandle: "left",
    type: "labeled",
    animated: true,
    label: "Webhook alert",
    className: "edge-alert",
    data: { labelOffset: { x: 0, y: -34 }, labelTone: "warning" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
    style: { stroke: "#f59e0b", strokeWidth: 3 },
  },
  {
    id: "minio-to-edge",
    source: "minio",
    sourceHandle: "right",
    target: "edge-k3s",
    targetHandle: "left",
    type: "labeled",
    animated: true,
    label: "Velero restore data",
    className: "edge-restore",
    data: { labelOffset: { x: 0, y: 36 }, labelTone: "restore" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
    style: { stroke: "#8b5cf6", strokeWidth: 5.5 },
  },
  {
    id: "ai-to-edge",
    source: "ai-orchestrator",
    sourceHandle: "bottom",
    target: "edge-k3s",
    targetHandle: "top",
    type: "labeled",
    animated: true,
    label: "Recovery priority command",
    className: "edge-command",
    data: { labelOffset: { x: 58, y: -38 }, labelTone: "command" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#2563eb" },
    style: { stroke: "#2563eb", strokeWidth: 2.75, strokeDasharray: "10 8" },
  },
];

const FALLBACK_MINIO_ENDPOINT = "http://10.0.2.11:30900";
const FALLBACK_MINIO_NODE_PORT = "30900";
const ALERT_RESOLVED_BADGE_MS = 30000;
const edgeLabelTones = {
  command: "border-blue-200 bg-white text-blue-700 shadow-blue-900/10",
  danger: "border-red-200 bg-white text-red-700 shadow-red-900/10",
  neutral: "border-slate-200 bg-white text-slate-700 shadow-slate-900/10",
  restore: "border-violet-200 bg-white text-violet-700 shadow-violet-900/10",
  warning: "border-amber-200 bg-white text-amber-800 shadow-amber-900/10",
};

function LabeledFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data,
  className,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
  });
  const labelOffset = data?.labelOffset ?? { x: 0, y: 0 };
  const tone = edgeLabelTones[data?.labelTone] ?? edgeLabelTones.neutral;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} className={className} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan pointer-events-none absolute z-50 max-w-[150px] rounded-md border px-2 py-1 text-center text-[10px] font-black leading-tight shadow-md ${tone}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + labelOffset.x}px, ${labelY + labelOffset.y}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function getApiResult(apiResults, key) {
  return apiResults?.[key]?.ok ? apiResults[key].data : null;
}

function getApiError(apiResults, key) {
  return apiResults?.[key]?.ok === false ? apiResults[key].error : null;
}

function unwrapPayload(payload) {
  return payload?.data ?? payload?.result ?? payload ?? {};
}

function readPath(source, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], source);
}

function firstValue(source, paths, fallback = undefined) {
  const value = unwrapPayload(source);

  for (const path of paths) {
    const result = readPath(value, path);

    if (result !== undefined && result !== null && result !== "") {
      return result;
    }
  }

  return fallback;
}

function asArray(payload, keys) {
  const value = unwrapPayload(payload);

  if (Array.isArray(value)) {
    return value;
  }

  for (const key of keys) {
    const result = readPath(value, key);

    if (Array.isArray(result)) {
      return result;
    }
  }

  return [];
}

function formatTime(value) {
  if (!value) {
    return "Live";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getAlertEventDotColor(event) {
  if (event?.status === "resolved" || event?.severity === "resolved") {
    return "bg-emerald-500";
  }

  if (String(event?.severity || "").toLowerCase() === "critical") {
    return "bg-red-500";
  }

  return "bg-amber-500";
}

function formatAlertEventText(event) {
  const alertname = firstValue(event, ["alertname"], "Alertmanager alert");
  const namespace = firstValue(event, ["namespace"], null);
  const clusterId = firstValue(event, ["clusterId"], "user-k8s");
  const scope = namespace || clusterId;
  const severity = firstValue(event, ["severity"], "warning");
  const status = firstValue(event, ["status"], "firing");

  return `${alertname} · ${scope} · ${severity} · ${status}`;
}

function buildAlertEventRows(events) {
  return events.slice(0, 5).map((event) => [
    formatTime(firstValue(event, ["receivedAt", "startsAt"])),
    formatAlertEventText(event),
    getAlertEventDotColor(event),
  ]);
}

function normalizeAlertEvent(event) {
  const value = unwrapPayload(event);
  const alertname = firstValue(value, ["labels.alertname", "alertname"], "Alertmanager alert");
  const namespace = firstValue(value, ["labels.namespace", "namespace"], null);
  const clusterId = firstValue(value, ["labels.clusterId", "labels.cluster", "clusterId", "cluster"], null);
  const severity = String(firstValue(value, ["labels.severity", "severity"], "warning")).toLowerCase();
  const status = String(firstValue(value, ["status"], "firing")).toLowerCase();
  const source = String(firstValue(value, ["source", "receiver"], "alertmanager")).toLowerCase();
  const startsAt = firstValue(value, ["startsAt", "starts_at"], null);
  const endsAt = firstValue(value, ["endsAt", "ends_at"], null);
  const receivedAt = firstValue(value, ["receivedAt", "received_at", "updatedAt", "time"], startsAt || endsAt);

  return {
    ...value,
    alertname,
    namespace,
    clusterId,
    severity,
    status,
    source,
    startsAt,
    endsAt,
    receivedAt,
  };
}

function extractAlertEvents(payload) {
  const value = unwrapPayload(payload);
  const events = asArray(value, ["events", "alerts", "event.alerts", "latest.alerts"]);

  if (events.length) {
    return events.map(normalizeAlertEvent);
  }

  const singleEvent = firstValue(value, ["event", "latest", "alert"], null);

  if (singleEvent) {
    return extractAlertEvents(singleEvent);
  }

  if (value && typeof value === "object" && (value.status || value.labels || value.alertname || value.namespace)) {
    return [normalizeAlertEvent(value)];
  }

  return [];
}

function getAlertEventKey(event) {
  return [
    firstValue(event, ["fingerprint", "id"], ""),
    firstValue(event, ["alertname"], "alert"),
    firstValue(event, ["namespace", "clusterId"], "cluster"),
    firstValue(event, ["status"], "firing"),
    firstValue(event, ["startsAt"], ""),
    firstValue(event, ["endsAt"], ""),
  ].join(":");
}

function getEventTimestamp(event) {
  const value = firstValue(event, ["receivedAt", "endsAt", "startsAt"], null);
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeAlertEvents(existingEvents, incomingEvents) {
  const eventMap = new Map();

  [...incomingEvents, ...existingEvents].forEach((event) => {
    const normalized = normalizeAlertEvent(event);
    const key = getAlertEventKey(normalized);

    if (!eventMap.has(key)) {
      eventMap.set(key, normalized);
    }
  });

  return Array.from(eventMap.values())
    .sort((left, right) => getEventTimestamp(right) - getEventTimestamp(left))
    .slice(0, 20);
}

function getAlertTargetNodes(alert) {
  const targets = new Set();
  const clusterId = String(alert.clusterId || "").toLowerCase();

  if (
    ["order-service", "auth-service", "analytics"].includes(alert.namespace) ||
    ["cloud-primary", "prod-cloud-main", "user-k8s", "my-cluster"].includes(clusterId) ||
    alert.alertname === "NodeNotReady"
  ) {
    targets.add("cloud-k8s");
  }

  if (["edge-recovery", "edge-k3s"].includes(clusterId)) {
    targets.add("edge-k3s");
  }

  if (alert.source === "alertmanager") {
    targets.add("prometheus");
  }

  return targets;
}

function buildAlertMetrics(alert) {
  return [
    ["Alert", alert.alertname],
    ["Scope", alert.namespace || alert.clusterId || "cluster"],
    ["Severity", alert.severity],
  ];
}

function getAlertTopologyState(events, now = Date.now()) {
  const normalizedEvents = events.map(normalizeAlertEvent);
  const firingEvents = normalizedEvents.filter((event) => event.status === "firing");
  const recentResolvedEvents = normalizedEvents.filter((event) => {
    if (event.status !== "resolved") {
      return false;
    }

    const timestamp = getEventTimestamp(event);

    return timestamp > 0 && now - timestamp <= ALERT_RESOLVED_BADGE_MS;
  });
  const nodes = {};

  firingEvents.forEach((event) => {
    getAlertTargetNodes(event).forEach((nodeId) => {
      const isCritical = event.severity === "critical";

      nodes[nodeId] = {
        status: nodeId === "prometheus" ? "alerting" : isCritical ? "outage" : "warning",
        detail:
          nodeId === "prometheus"
            ? `${event.alertname} webhook received`
            : `${event.alertname} is ${event.status} for ${event.namespace || event.clusterId || "cluster"}`,
        metrics: buildAlertMetrics(event),
        pulse: isCritical,
      };
    });
  });

  recentResolvedEvents.forEach((event) => {
    getAlertTargetNodes(event).forEach((nodeId) => {
      if (!nodes[nodeId]) {
        nodes[nodeId] = {
          status: "recovered",
          detail: `${event.alertname} resolved`,
          metrics: buildAlertMetrics(event),
          pulse: false,
        };
      }
    });
  });

  return {
    hasFiring: firingEvents.length > 0,
    hasCriticalFiring: firingEvents.some((event) => event.severity === "critical"),
    hasRecentResolved: recentResolvedEvents.length > 0,
    nodes,
  };
}

function applyAlertTopologyToNode(nodeId, data, alertState, pendingWorkloadId, restoreWorkloadId, restoreRecovered) {
  if (restoreRecovered && nodeId === "edge-k3s") {
    return {
      ...data,
      status: "recovered",
      detail: `${restoreWorkloadId || "Workload"} restore completed on Edge K3s`,
      metrics: [
        ["Restore", "Completed"],
        ["Workload", restoreWorkloadId || "Ready"],
        ["Traffic", "Ready"],
      ],
    };
  }

  if (restoreWorkloadId && nodeId === "edge-k3s") {
    return {
      ...data,
      status: "restoring",
      detail: `${restoreWorkloadId} restore requested on Edge K3s`,
      metrics: [
        ["Cluster", "edge-recovery"],
        ["Restore", "Triggered"],
        ["Workload", restoreWorkloadId],
      ],
    };
  }

  if (alertState.nodes[nodeId]) {
    return {
      ...data,
      ...alertState.nodes[nodeId],
    };
  }

  if (alertState.hasFiring && nodeId === "ai-orchestrator") {
    return {
      ...data,
      status: "processing",
      detail: "Processing alert context for recovery recommendation",
      metrics: [
        ["Mode", "Alert analysis"],
        ["Input", "Latest event"],
        ["Action", "Recommendation pending"],
      ],
    };
  }

  if (pendingWorkloadId && nodeId === "ai-orchestrator") {
    return {
      ...data,
      status: "processing",
      detail: "Saving recovery approval state",
      metrics: [
        ["Workload", pendingWorkloadId],
        ["Action", "Approval"],
        ["State", "Pending"],
      ],
    };
  }

  if (alertState.hasFiring && nodeId === "edge-k3s") {
    return {
      ...data,
      status: "standby",
      detail: "Recovery target is standing by; restore not started",
      metrics: [
        ["Cluster", "edge-recovery"],
        ["Restore", "Not started"],
        ["Mode", "Standby"],
      ],
    };
  }

  return data;
}

function getEdgeFlowState(alertState, activeCluster, restoreWorkloadId, restoreRecovered) {
  if (restoreWorkloadId && !restoreRecovered) {
    return "restore";
  }

  if (alertState.hasFiring) {
    return "alert";
  }

  if (alertState.hasRecentResolved) {
    return "resolved";
  }

  if (activeCluster?.nodeOverrides?.["edge-k3s"]?.status === "restoring") {
    return "restore";
  }

  return "normal";
}

function buildAlertAwareEdges(edges, flowState) {
  const edgeStyles = {
    alert: { className: "edge-alert-state", color: "#ef4444", strokeWidth: 3, labelTone: "danger" },
    normal: { className: "edge-normal-state", color: "#10b981", strokeWidth: 2.5, labelTone: "neutral" },
    resolved: { className: "edge-resolved-state", color: "#10b981", strokeWidth: 2.75, labelTone: "neutral" },
    restore: { className: "edge-restore-state", color: "#8b5cf6", strokeWidth: 4, labelTone: "restore" },
  };
  const style = edgeStyles[flowState] ?? edgeStyles.normal;

  return edges.map((edge) => ({
    ...edge,
    className: style.className,
    data: {
      ...edge.data,
      labelTone: style.labelTone,
    },
    markerEnd: {
      ...edge.markerEnd,
      color: style.color,
    },
    style: {
      ...edge.style,
      stroke: style.color,
      strokeWidth: style.strokeWidth,
      strokeDasharray: "10 8",
    },
  }));
}

function isReadyLike(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["ready", "running", "healthy", "available", "true", "ok"].includes(value.toLowerCase());
  }

  return false;
}

function getNodeReadiness(payload, fallbackName) {
  const value = unwrapPayload(payload);
  const nodes = asArray(payload, ["nodes", "items", "status.nodes"]);
  const node = nodes[0] ?? firstValue(value, ["node", "status.node"], {});
  const explicitReady = firstValue(value, ["ready", "healthy", "healthStatus", "status.ready", "status.healthy"]);
  const readyCount =
    nodes.length > 0
      ? nodes.filter((item) =>
          isReadyLike(firstValue(item, ["ready", "status", "phase", "condition", "conditions.Ready"], false)),
        ).length
      : isReadyLike(explicitReady)
        ? 1
        : 0;
  const total = nodes.length || (explicitReady !== undefined ? 1 : 1);
  const name = firstValue(node, ["name", "metadata.name", "hostname"], firstValue(value, ["name", "nodeName"], fallbackName));
  const phase = firstValue(node, ["status", "phase"], firstValue(value, ["healthStatus", "status", "phase", "health"], readyCount > 0 ? "Ready" : "NotReady"));

  return {
    name,
    phase,
    readyCount,
    total,
    ready: readyCount > 0,
  };
}

function getStatusMeta(label) {
  if (label === "Incident") {
    return {
      statusBadge: "bg-red-50 text-red-700 ring-red-200",
      statusDot: "bg-red-500",
      impact: "P1",
    };
  }

  if (label === "Warning" || label === "Syncing") {
    return {
      statusBadge: "bg-amber-50 text-amber-800 ring-amber-200",
      statusDot: "bg-amber-500",
      impact: "P2",
    };
  }

  return {
    statusBadge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    statusDot: "bg-emerald-500",
    impact: "P3",
  };
}

function endpointErrors(apiResults) {
  if (!apiResults) {
    return [];
  }

  return Object.entries(apiResults)
    .filter(([, result]) => result?.ok === false)
    .map(([, result]) => result.error);
}

function validationErrors(apiResults) {
  if (!apiResults) {
    return [];
  }

  return ["cloudValidation", "edgeValidation"]
    .map((key) => getApiResult(apiResults, key))
    .filter((result) => result?.valid === false)
    .map((result) => {
      const failedCheck = result.checks?.find((check) => check.status === "failed");
      return failedCheck?.message || `${result.clusterId} validation failed`;
    });
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value))));
}

function ratioPercent(part, total) {
  const denominator = toNumber(total);

  if (denominator <= 0) {
    return 0;
  }

  return clampPercent((toNumber(part) / denominator) * 100);
}

function metricTone(percent) {
  if (percent >= 80) {
    return "bg-emerald-500";
  }

  if (percent >= 50) {
    return "bg-amber-400";
  }

  return "bg-red-500";
}

const metricStateStyles = {
  healthy: {
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    value: "text-emerald-700",
    track: "bg-emerald-50 ring-emerald-100",
  },
  warning: {
    dot: "bg-amber-400",
    bar: "bg-amber-400",
    value: "text-amber-800",
    track: "bg-amber-50 ring-amber-100",
  },
  error: {
    dot: "bg-red-500",
    bar: "bg-red-500",
    value: "text-red-700",
    track: "bg-red-50 ring-red-100",
  },
  empty: {
    dot: "bg-slate-300",
    bar: "bg-slate-300",
    value: "text-slate-500",
    track: "bg-slate-50 ring-slate-200",
  },
  loading: {
    dot: "bg-sky-500",
    bar: "bg-sky-500",
    value: "text-sky-700",
    track: "bg-sky-50 ring-sky-100",
  },
};

function metricStateFromPercent(percent) {
  if (percent >= 80) {
    return "healthy";
  }

  if (percent >= 50) {
    return "warning";
  }

  return "error";
}

function formatMetricAge(minutes) {
  if (minutes === null || minutes === undefined) {
    return "No data";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

function buildMetricGroups(apiResults, apiLoading) {
  const cloudMetrics = getApiResult(apiResults, "cloudMetrics");
  const edgeMetrics = getApiResult(apiResults, "edgeMetrics");
  const cloudWorkloads = getApiResult(apiResults, "cloudWorkloads") || cloudMetrics;
  const edgeWorkloads = getApiResult(apiResults, "edgeWorkloads") || edgeMetrics;
  const freshness = getApiResult(apiResults, "cloudBackupFreshness") || cloudMetrics;
  const readiness = getApiResult(apiResults, "edgeRestoreReadiness") || edgeMetrics;
  const cloudTotalPods = firstValue(cloudWorkloads, ["summary.totalPods", "workloads.totalPods"], 0);
  const cloudRunningPods = firstValue(cloudWorkloads, ["summary.runningPods", "workloads.runningPods"], 0);
  const edgeTotalPods = firstValue(edgeWorkloads, ["summary.totalPods", "workloads.totalPods"], 0);
  const edgeRunningPods = firstValue(edgeWorkloads, ["summary.runningPods", "workloads.runningPods"], 0);
  const latestAge = firstValue(freshness, ["backupFreshness.ageMinutes"], null);
  const backupCount = firstValue(freshness, ["backupFreshness.backupCount"], 0);
  const completedBackups = firstValue(freshness, ["backupFreshness.completedBackups"], 0);
  const readinessScore = firstValue(readiness, ["restoreReadiness.score"], 0);
  const cloudMetricsError = getApiError(apiResults, "cloudMetrics");
  const edgeMetricsError = getApiError(apiResults, "edgeMetrics");
  const cloudWorkloadsError = getApiError(apiResults, "cloudWorkloads");
  const edgeWorkloadsError = getApiError(apiResults, "edgeWorkloads");
  const freshnessError = getApiError(apiResults, "cloudBackupFreshness");
  const readinessError = getApiError(apiResults, "edgeRestoreReadiness");

  if (apiLoading) {
    return [
      {
        title: "Cluster Health",
        rows: [
          { label: "Cloud K8s", value: "Syncing", detail: "Waiting for node status", percent: 36, state: "loading" },
          { label: "Edge K3s", value: "Syncing", detail: "Waiting for node status", percent: 36, state: "loading" },
        ],
      },
      {
        title: "Workload Health",
        rows: [
          { label: "Cloud pods", value: "Syncing", detail: "Collecting pod totals", percent: 36, state: "loading" },
          { label: "Edge pods", value: "Syncing", detail: "Collecting pod totals", percent: 36, state: "loading" },
        ],
      },
      {
        title: "Backup Freshness",
        rows: [{ label: "Latest backup", value: "Syncing", detail: "Checking Velero history", percent: 36, state: "loading" }],
      },
      {
        title: "Restore Readiness",
        rows: [{ label: "Edge target", value: "Syncing", detail: "Checking target readiness", percent: 36, state: "loading" }],
      },
    ];
  }

  const cloudReady = firstValue(cloudMetrics, ["node.ready"], false);
  const edgeReady = firstValue(edgeMetrics, ["node.ready"], false);
  const cloudPodPercent = ratioPercent(cloudRunningPods, cloudTotalPods);
  const edgePodPercent = ratioPercent(edgeRunningPods, edgeTotalPods);
  const latestBackupPercent = latestAge === null ? 0 : clampPercent(100 - Math.max(0, latestAge - 15));
  const completedBackupPercent = ratioPercent(completedBackups, backupCount);

  return [
    {
      title: "Cluster Health",
      rows: [
        cloudMetricsError ? {
          label: "Cloud K8s",
          value: "API error",
          detail: "Metric endpoint did not return a usable response",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Cloud K8s",
          value: firstValue(cloudMetrics, ["node.healthStatus"], "No signal"),
          detail: firstValue(cloudMetrics, ["node.nodeName"], "No node heartbeat received"),
          percent: cloudReady ? 100 : 0,
          percentLabel: cloudReady ? "Ready" : "Not ready",
          state: cloudReady ? "healthy" : "warning",
        },
        edgeMetricsError ? {
          label: "Edge K3s",
          value: "API error",
          detail: "Metric endpoint did not return a usable response",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Edge K3s",
          value: firstValue(edgeMetrics, ["node.healthStatus"], "No signal"),
          detail: firstValue(edgeMetrics, ["node.nodeName"], "No node heartbeat received"),
          percent: edgeReady ? 100 : 0,
          percentLabel: edgeReady ? "Ready" : "Not ready",
          state: edgeReady ? "healthy" : "warning",
        },
      ],
    },
    {
      title: "Workload Health",
      rows: [
        cloudWorkloadsError ? {
          label: "Cloud pods",
          value: "API error",
          detail: "Pod metric endpoint is unavailable",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Cloud pods",
          value: cloudTotalPods ? `${cloudRunningPods}/${cloudTotalPods} running` : "No pod signal",
          detail: cloudTotalPods ? `${cloudTotalPods - cloudRunningPods} pods not running` : "No workload metrics received",
          percent: cloudTotalPods ? cloudPodPercent : 100,
          percentLabel: cloudTotalPods ? `${cloudPodPercent}%` : "No data",
          state: cloudTotalPods ? metricStateFromPercent(cloudPodPercent) : "empty",
        },
        edgeWorkloadsError ? {
          label: "Edge pods",
          value: "API error",
          detail: "Pod metric endpoint is unavailable",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Edge pods",
          value: edgeTotalPods ? `${edgeRunningPods}/${edgeTotalPods} running` : "No pod signal",
          detail: edgeTotalPods ? `${edgeTotalPods - edgeRunningPods} pods not running` : "No workload metrics received",
          percent: edgeTotalPods ? edgePodPercent : 100,
          percentLabel: edgeTotalPods ? `${edgePodPercent}%` : "No data",
          state: edgeTotalPods ? metricStateFromPercent(edgePodPercent) : "empty",
        },
      ],
    },
    {
      title: "Backup Freshness",
      rows: [
        freshnessError ? {
          label: "Latest backup age",
          value: "API error",
          detail: "Backup freshness endpoint is unavailable",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Latest backup age",
          value: latestAge === null ? "No backup signal" : formatMetricAge(latestAge),
          detail: latestAge === null ? "No completed backup reported" : firstValue(freshness, ["backupFreshness.latestBackupName"], "Latest completed backup"),
          percent: latestAge === null ? 100 : latestBackupPercent,
          percentLabel: latestAge === null ? "No data" : `${latestBackupPercent}%`,
          state: latestAge === null ? "empty" : metricStateFromPercent(latestBackupPercent),
        },
        freshnessError ? {
          label: "Completed backups",
          value: "API error",
          detail: "Backup history could not be checked",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Completed backups",
          value: backupCount ? `${completedBackups}/${backupCount}` : "No backups",
          detail: backupCount ? `${backupCount - completedBackups} backups need attention` : "No backup history reported",
          percent: backupCount ? completedBackupPercent : 100,
          percentLabel: backupCount ? `${completedBackupPercent}%` : "No data",
          state: backupCount ? metricStateFromPercent(completedBackupPercent) : "empty",
        },
      ],
    },
    {
      title: "Restore Readiness",
      rows: [
        readinessError ? {
          label: "Edge target",
          value: "API error",
          detail: "Restore readiness endpoint is unavailable",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Edge target",
          value: firstValue(readiness, ["restoreReadiness.status"], "No signal"),
          detail: firstValue(readiness, ["restoreReadiness.checks.0.message"], "No readiness check received"),
          percent: readiness ? clampPercent(readinessScore) : 100,
          percentLabel: readiness ? `${clampPercent(readinessScore)}%` : "No data",
          state: readiness ? metricStateFromPercent(readinessScore) : "empty",
        },
        readinessError ? {
          label: "Storage path",
          value: "API error",
          detail: "Storage reachability could not be checked",
          percent: 100,
          percentLabel: "Needs check",
          state: "error",
        } : {
          label: "Storage path",
          value: firstValue(readiness, ["restoreReadiness.storageReachable"], false) ? "Reachable" : "Unavailable",
          detail: firstValue(readiness, ["restoreReadiness.checks.2.message"], "Backup storage check"),
          percent: firstValue(readiness, ["restoreReadiness.storageReachable"], false) ? 100 : 100,
          percentLabel: firstValue(readiness, ["restoreReadiness.storageReachable"], false) ? "Ready" : "Blocked",
          state: firstValue(readiness, ["restoreReadiness.storageReachable"], false) ? "healthy" : "error",
        },
      ],
    },
  ];
}

function getRecoveryRecommendations(apiResults) {
  return asArray(getApiResult(apiResults, "cloudRecommendations"), ["recommendations"]);
}

function deriveOverallStatus(apiResults, apiLoading) {
  if (apiLoading) {
    return "Syncing";
  }

  const cloudStatus = getApiResult(apiResults, "cloudStatus");
  const edgeStatus = getApiResult(apiResults, "edgeStatus");
  const veleroLocation = getApiResult(apiResults, "veleroLocation");
  const cloud = cloudStatus ? getNodeReadiness(cloudStatus, "k8s-master") : null;
  const edge = edgeStatus ? getNodeReadiness(edgeStatus, "edge-k3s") : null;
  const veleroPhase = firstValue(veleroLocation, ["status.phase", "phase"], "Unknown");

  if (cloud && !cloud.ready) {
    return "Incident";
  }

  if (endpointErrors(apiResults).length > 0 || validationErrors(apiResults).length > 0 || (edge && !edge.ready) || veleroPhase !== "Available") {
    return "Warning";
  }

  return "Protected";
}

function deriveAgentDashboardStatus(cluster) {
  const connected = firstValue(cluster, ["agent.connected"], false);
  const nodes = asArray(firstValue(cluster, ["agent.state"], null), ["nodes"]);
  const failedPods = firstValue(cluster, ["agent.state.workloads.failedPods"], 0);

  if (!connected) {
    return "Warning";
  }

  if (nodes.some((node) => firstValue(node, ["status"], "Unknown") !== "Ready")) {
    return "Incident";
  }

  if (toNumber(failedPods) > 0) {
    return "Warning";
  }

  return "Protected";
}

function buildAgentStreamRows(cluster) {
  const agent = firstValue(cluster, ["agent"], null);
  const nodes = asArray(firstValue(cluster, ["agent.state"], null), ["nodes"]);
  const backups = asArray(firstValue(cluster, ["agent.state"], null), ["backups"]).slice(0, 2);
  const rows = [];

  if (agent?.lastHeartbeatAt) {
    rows.push([formatTime(agent.lastHeartbeatAt), `${cluster.name} agent heartbeat received`, "bg-emerald-500"]);
  }

  nodes.slice(0, 2).forEach((node) => {
    const status = firstValue(node, ["status"], "Unknown");
    rows.push([
      "Agent",
      `${firstValue(node, ["name"], "node")} · ${status}`,
      status === "Ready" ? "bg-emerald-500" : "bg-amber-500",
    ]);
  });

  backups.forEach((backup) => {
    const phase = firstValue(backup, ["phase"], "Unknown");
    rows.push([
      formatTime(firstValue(backup, ["timestamp"], null)),
      `${firstValue(backup, ["name"], "backup")} · ${phase}`,
      phase === "Completed" ? "bg-emerald-500" : "bg-amber-500",
    ]);
  });

  return rows;
}

function buildNodeHealthOverride({ payload, loading, error, fallbackName, loadingDetail, errorDetail, safeDetail }) {
  if (loading) {
    return {
      status: "analyzing",
      detail: loadingDetail,
      metrics: [
        ["Node", fallbackName],
        ["Health", "Loading"],
        ["Source", "Backend API"],
      ],
    };
  }

  if (error || !payload) {
    return {
      status: "alerting",
      detail: errorDetail,
      metrics: [
        ["Node", fallbackName],
        ["Health", "Unavailable"],
        ["Source", "API error"],
      ],
    };
  }

  const node = getNodeReadiness(payload, fallbackName);

  return {
    status: node.ready ? "safe" : "error",
    detail: node.ready ? safeDetail : `${node.name} reports ${node.phase}`,
    metrics: [
      ["Node", node.name],
      ["Health", `${node.readyCount}/${node.total} ready`],
      ["Phase", node.phase],
    ],
  };
}

function buildMinioOverride(apiResults, apiLoading) {
  const minio = getApiResult(apiResults, "minioStatus");
  const velero = getApiResult(apiResults, "veleroLocation");
  const backups = asArray(getApiResult(apiResults, "backups"), ["backups", "items"]);
  const hasStorageError = getApiError(apiResults, "minioStatus") || getApiError(apiResults, "veleroLocation");

  if (apiLoading) {
    return {
      status: "analyzing",
      detail: "Loading MinIO, Velero location, and backup history...",
      metrics: [
        ["NodePort", FALLBACK_MINIO_NODE_PORT],
        ["Endpoint", FALLBACK_MINIO_ENDPOINT],
        ["Velero", "Loading"],
      ],
    };
  }

  const endpoint = firstValue(
    minio,
    ["endpoint", "url", "expectedApiEndpointFromK8sMaster", "service.endpoint", "service.url", "nodePortEndpoint"],
    firstValue(velero, ["spec.config.s3Url", "config.s3Url", "s3Url"], FALLBACK_MINIO_ENDPOINT),
  );
  const nodePort = String(firstValue(minio, ["apiNodePort", "nodePort", "service.nodePort", "ports.0.nodePort"], FALLBACK_MINIO_NODE_PORT));
  const bucket = firstValue(velero, ["spec.objectStorage.bucket", "objectStorage.bucket", "bucket"], "velero-backups");
  const phase = firstValue(velero, ["status.phase", "phase"], hasStorageError ? "Unavailable" : "Available");
  const minioStatus = firstValue(minio, ["status", "phase", "health"], hasStorageError ? "Unavailable" : "Ready");
  const latestBackup = backups.find((backup) => firstValue(backup, ["status.phase", "phase"], "").toLowerCase() === "completed") ?? backups[0];
  const latestBackupName = firstValue(latestBackup, ["backupName", "metadata.name", "name"], backups.length ? "Recent backup" : "No backup history");

  return {
    status: hasStorageError || !isReadyLike(minioStatus) || phase !== "Available" ? "alerting" : "safe",
    detail: hasStorageError ? "Storage API returned a safe dashboard error" : `Velero location ${phase}; latest backup ${latestBackupName}`,
    metrics: [
      ["NodePort", nodePort],
      ["Endpoint", endpoint],
      ["Velero", `${bucket} · ${phase}`],
    ],
  };
}

function buildLiveStream(apiResults, apiLoading, fallbackStream, alertEvents = []) {
  const alertRows = buildAlertEventRows(alertEvents);

  if (apiLoading) {
    return [...alertRows, ["Live", "Backend status APIs loading", "bg-sky-500"], ...fallbackStream.slice(0, 4)];
  }

  const rows = [];
  const errors = endpointErrors(apiResults);
  const cloud = getApiResult(apiResults, "cloudStatus");
  const edge = getApiResult(apiResults, "edgeStatus");
  const minio = getApiResult(apiResults, "minioStatus");
  const velero = getApiResult(apiResults, "veleroLocation");
  const backups = asArray(getApiResult(apiResults, "backups"), ["backups", "items"]).slice(0, 3);
  const validations = validationErrors(apiResults);

  if (cloud) {
    const node = getNodeReadiness(cloud, "k8s-master");
    rows.push(["Cloud", `${node.name} health ${node.readyCount}/${node.total} ready`, node.ready ? "bg-emerald-500" : "bg-red-500"]);
  }

  if (edge) {
    const node = getNodeReadiness(edge, "edge-k3s");
    rows.push(["Edge", `${node.name} health ${node.readyCount}/${node.total} ready`, node.ready ? "bg-emerald-500" : "bg-amber-500"]);
  }

  if (minio) {
    const endpoint = firstValue(minio, ["endpoint", "url", "expectedApiEndpointFromK8sMaster", "service.endpoint"], FALLBACK_MINIO_ENDPOINT);
    rows.push(["MinIO", `NodePort storage endpoint ${endpoint}`, "bg-emerald-500"]);
  }

  if (velero) {
    const bucket = firstValue(velero, ["spec.objectStorage.bucket", "objectStorage.bucket", "bucket"], "velero-backups");
    const s3Url = firstValue(velero, ["spec.config.s3Url", "config.s3Url", "s3Url"], FALLBACK_MINIO_ENDPOINT);
    const phase = firstValue(velero, ["status.phase", "phase"], "Unknown");
    rows.push(["Velero", `${bucket} · ${s3Url} · ${phase}`, phase === "Available" ? "bg-emerald-500" : "bg-amber-500"]);
  }

  backups.forEach((backup) => {
    const phase = firstValue(backup, ["status.phase", "phase", "status"], "Unknown");
    const name = firstValue(backup, ["backupName", "metadata.name", "name"], "backup");
    const time = formatTime(firstValue(backup, ["status.completionTimestamp", "completionTimestamp", "createdTimestamp", "createdAt", "metadata.creationTimestamp"]));
    rows.push([time, `${name} · ${phase}`, phase === "Completed" ? "bg-emerald-500" : "bg-amber-500"]);
  });

  errors.slice(0, 2).forEach(() => {
    rows.push(["API", "Backend API unavailable or command failed; secrets hidden", "bg-red-500"]);
  });

  validations.slice(0, 2).forEach((message) => {
    rows.push(["Validate", message, "bg-amber-500"]);
  });

  const liveRows = [...alertRows, ...rows];

  return liveRows.length ? liveRows : fallbackStream;
}

function buildDashboardClusters(apiResults, apiLoading, alertEvents = []) {
  const apiClusters = asArray(getApiResult(apiResults, "clusters"), ["clusters", "items"]);
  const hasClusterResponse = Boolean(getApiResult(apiResults, "clusters"));
  const overallStatus = deriveOverallStatus(apiResults, apiLoading);
  const safeErrors = endpointErrors(apiResults);
  const validationIssues = validationErrors(apiResults);
  const liveNodeOverrides = {
    "cloud-k8s": buildNodeHealthOverride({
      payload: getApiResult(apiResults, "cloudStatus"),
      loading: apiLoading,
      error: getApiError(apiResults, "cloudStatus"),
      fallbackName: "k8s-master",
      loadingDetail: "Loading Cloud K8s node health...",
      errorDetail: "Cloud K8s status API unavailable",
      safeDetail: "Cloud K8s node is Ready",
    }),
    prometheus: {
      status: apiLoading ? "analyzing" : safeErrors.length || validationIssues.length ? "alerting" : "safe",
      detail: apiLoading ? "Waiting for backend status responses" : safeErrors.length || validationIssues.length ? "One or more backend probes failed safely" : "Backend status APIs responding",
      metrics: [
        ["Signal", apiLoading ? "Syncing" : "API poll"],
        ["Errors", String(safeErrors.length)],
        ["Validation", validationIssues.length ? "Failed" : "Passed"],
      ],
    },
    minio: buildMinioOverride(apiResults, apiLoading),
    "ai-orchestrator": {
      status: apiLoading ? "analyzing" : "safe",
      detail: apiLoading ? "Waiting for live infrastructure context" : "Using API-backed infrastructure context",
      metrics: [
        ["Model", "Not connected"],
        ["Inputs", "Live status"],
        ["Action", "Recommend only"],
      ],
    },
    "edge-k3s": buildNodeHealthOverride({
      payload: getApiResult(apiResults, "edgeStatus"),
      loading: apiLoading,
      error: getApiError(apiResults, "edgeStatus"),
      fallbackName: "edge-k3s",
      loadingDetail: "Loading Edge K3s node health...",
      errorDetail: "Edge K3s status API unavailable",
      safeDetail: "Edge K3s node is Ready",
    }),
  };
  const sourceClusters = apiClusters.length
    ? apiClusters.map((cluster, index) => {
        const template = clusterScenarios[index] ?? clusterScenarios[0];
        const isAgentCluster = firstValue(cluster, ["kind"], "") === "user-k8s";
        const agentBackups = asArray(firstValue(cluster, ["agent.state"], null), ["backups"]);
        const latestBackup = agentBackups[0];

        return {
          ...template,
          id: firstValue(cluster, ["id", "name", "metadata.name"], template.id),
          name: firstValue(cluster, ["displayName", "name", "metadata.name", "id"], template.name),
          provider: firstValue(cluster, ["provider", "kind", "clusterKind", "type", "distribution"], template.provider),
          region: firstValue(cluster, ["region", "location", "nodeIp"], template.region),
          environment: firstValue(cluster, ["environment", "env"], template.environment),
          rto: isAgentCluster ? "Agent" : template.rto,
          rpo: isAgentCluster ? firstValue(latestBackup, ["phase"], "No backup") : template.rpo,
          policy: isAgentCluster ? "Agent heartbeat · Velero command polling" : template.policy,
          agent: cluster.agent || null,
          isAgentCluster,
        };
      })
    : apiLoading || !hasClusterResponse
      ? clusterScenarios
      : [];

  return sourceClusters.map((cluster) => {
    const clusterStatus = cluster.isAgentCluster ? deriveAgentDashboardStatus(cluster) : overallStatus;
    const statusMeta = getStatusMeta(clusterStatus);
    const agentStream = cluster.isAgentCluster ? buildAgentStreamRows(cluster) : [];

    return {
      ...cluster,
      ...statusMeta,
      status: clusterStatus,
      updatedAt: apiLoading
        ? "Loading live API data"
        : cluster.isAgentCluster
          ? firstValue(cluster, ["agent.lastHeartbeatAt"], "Waiting for agent heartbeat")
          : safeErrors.length || validationIssues.length ? "Live API partial warning" : "Live API synced",
      description: apiLoading
        ? "TASK-02 백엔드 API에서 Cloud, Edge, MinIO, Velero 상태를 불러오는 중입니다."
        : cluster.isAgentCluster
          ? "dr-agent가 push한 heartbeat를 기반으로 외부 사용자 클러스터 상태를 표시합니다."
          : "Registry-backed API 응답을 기반으로 Cloud K8s, Edge K3s, MinIO, Velero 상태를 표시합니다.",
      stream: cluster.isAgentCluster
        ? [...buildAlertEventRows(alertEvents), ...agentStream, ...cluster.stream].slice(0, 5)
        : buildLiveStream(apiResults, apiLoading, cluster.stream, alertEvents),
      nodeOverrides: {
        ...cluster.nodeOverrides,
        ...liveNodeOverrides,
      },
    };
  });
}

function Icon({ name, className = "h-5 w-5" }) {
  const paths = {
    brain: (
      <>
        <path d="M9 4a3 3 0 0 0-5 2.6 3.1 3.1 0 0 0 1.3 5.9A3.6 3.6 0 0 0 9 18V4Z" />
        <path d="M15 4a3 3 0 0 1 5 2.6 3.1 3.1 0 0 1-1.3 5.9A3.6 3.6 0 0 1 15 18V4Z" />
        <path d="M9 8H6.5M15 8h2.5M9 13H6.8M15 13h2.2" />
      </>
    ),
    cloud: <path d="M6.5 18h10.2a4.4 4.4 0 0 0 .3-8.8A6.4 6.4 0 0 0 4.8 11 3.8 3.8 0 0 0 6.5 18Z" />,
    database: (
      <>
        <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
        <path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
        <path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
      </>
    ),
    edge: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8M8 15h8M9 4v16M15 4v16" />
      </>
    ),
    pulse: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    shield: (
      <>
        <path d="M12 3 5 6v5.2c0 4.5 2.9 7.6 7 8.8 4.1-1.2 7-4.3 7-8.8V6l-7-3Z" />
        <path d="m9.5 12 1.8 1.8 3.7-4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
        <path d="m18 14 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2.7 19h18.6L12 3Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function FlowHandle({ type, position, id }) {
  return (
    <Handle
      id={id}
      type={type}
      position={position}
      className="!h-3 !w-3 !border-2 !border-white !bg-slate-400 !opacity-0"
    />
  );
}

function DisasterRecoveryNode({ data }) {
  const status = statusStyles[data.status] ?? statusStyles.safe;

  return (
    <div
      className={`w-[260px] rounded-lg border ${status.border} bg-white shadow-xl ${status.glow} transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${
        data.pulse ? "dr-node-pulse" : ""
      }`}
    >
      <FlowHandle id="left" type="target" position={Position.Left} />
      <FlowHandle id="right" type="source" position={Position.Right} />
      <FlowHandle id="top" type="target" position={Position.Top} />
      <FlowHandle id="bottom" type="source" position={Position.Bottom} />

      <div className="flex items-start gap-3 border-b border-slate-100 p-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${status.icon}`}>
          <Icon name={data.icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="min-w-0 text-[15px] font-bold leading-5 text-slate-950">{data.label}</h3>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${status.badge}`}>
              <span className={`h-2 w-2 rounded-full ${status.dot} shadow-lg`} />
              {status.label}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{data.subtitle}</p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          {data.detail}
        </div>
        <dl className="grid gap-2">
          {data.metrics.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-xs">
              <dt className="font-medium text-slate-500">{label}</dt>
              <dd className="font-bold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

function MetricGraphPanel({ group }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-950">{group.title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
          API
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        {group.rows.map((row) => {
          const style = metricStateStyles[row.state] ?? metricStateStyles[metricStateFromPercent(clampPercent(row.percent))];
          const percent = clampPercent(row.percent);

          return (
            <div key={`${group.title}-${row.label}`} className={`rounded-md px-3 py-3 ring-1 ${style.track}`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                    <span className="font-black text-slate-700">{row.label}</span>
                  </div>
                  {row.detail && (
                    <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                      {row.detail}
                    </div>
                  )}
                </div>
                <span className={`shrink-0 text-sm font-black ${style.value}`}>{row.value}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                <div
                  className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-1 text-right text-[11px] font-black text-slate-400">
                {row.percentLabel ?? `${percent}%`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RegistrationGuidance() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5 text-slate-950">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
            <Icon name="shield" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-slate-950">Dashboard token required</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              클러스터별 격리가 켜져 있습니다. `POST /api/auth/register`로 발급된 대시보드 URL을 사용하거나,
              dr-agent 설치 과정에서 받은 `?token=usr_...` 링크로 접속하세요.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function getRecommendationWorkloadId(recommendation) {
  return firstValue(recommendation, ["workloadId", "namespace", "name", "metadata.name"], "unknown-workload");
}

function getRecommendationRank(recommendation, index) {
  return firstValue(recommendation, ["rank", "priority"], index + 1);
}

const terminalRestoreStatuses = new Set(["Completed", "Failed"]);
const requireDashboardToken = import.meta.env.VITE_REQUIRE_DASHBOARD_TOKEN === "true";
const restoreProgressByStatus = {
  PendingAgent: 15,
  Submitted: 35,
  New: 40,
  Running: 60,
  InProgress: 60,
  PartiallyFailed: 85,
  Completed: 100,
  Failed: 100,
};

function getRestorePhase(operation) {
  if (!operation) {
    return null;
  }

  return firstValue(operation.statusPayload, ["restore.status", "restore.phase", "status", "phase"], operation.phase || "PendingAgent");
}

function isTerminalRestorePhase(phase) {
  return terminalRestoreStatuses.has(phase);
}

function getRestoreProgressPercent(phase) {
  return restoreProgressByStatus[phase] ?? (isTerminalRestorePhase(phase) ? 100 : 50);
}

function getRestoreTime(operation, paths, fallback) {
  return firstValue(operation?.statusPayload, paths, fallback);
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];

  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function parseDurationToMilliseconds(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);

  if (!match || !text) {
    return null;
  }

  const hours = Number.parseInt(match[1] || "0", 10);
  const minutes = Number.parseInt(match[2] || "0", 10);
  const seconds = Number.parseInt(match[3] || "0", 10);

  return ((hours * 60 * 60) + (minutes * 60) + seconds) * 1000;
}

function getIncidentStartedAt(alertEvents) {
  const firingEvents = alertEvents
    .filter((event) => event.status !== "resolved")
    .map((event) => firstValue(event, ["startsAt", "receivedAt"], null))
    .filter(Boolean)
    .sort();

  return firingEvents[0] || null;
}

function getRestoreEstimateLabel(phase, percent) {
  if (phase === "Completed") {
    return "완료";
  }

  if (phase === "Failed") {
    return "확인 필요";
  }

  if (percent >= 80) {
    return "완료 확인 중";
  }

  if (percent >= 50) {
    return "워크로드 복원 중";
  }

  return "Velero 작업 제출 중";
}

function RestoreProgressPanel({ operation, clock, incidentStartedAt, rtoTarget, onRetry }) {
  if (!operation) {
    return null;
  }

  const phase = getRestorePhase(operation);
  const percent = getRestoreProgressPercent(phase);
  const startedAt = getRestoreTime(operation, ["restore.startTimestamp", "restore.createdTimestamp", "acceptedTimestamp"], operation.startedAt);
  const completedAt = getRestoreTime(operation, ["restore.completionTimestamp"], operation.completedAt);
  const elapsedEnd = completedAt ? new Date(completedAt).getTime() : clock;
  const elapsedStart = new Date(startedAt || operation.startedAt).getTime();
  const elapsed = Number.isFinite(elapsedStart) ? elapsedEnd - elapsedStart : 0;
  const rtoStart = new Date(incidentStartedAt || operation.startedAt).getTime();
  const rtoEnd = completedAt ? new Date(completedAt).getTime() : null;
  const actualRto = rtoEnd && Number.isFinite(rtoStart) ? rtoEnd - rtoStart : null;
  const targetRto = parseDurationToMilliseconds(rtoTarget);
  const rtoMet = actualRto !== null && targetRto !== null ? actualRto <= targetRto : null;
  const failed = phase === "Failed";
  const completed = phase === "Completed";
  const message = firstValue(operation.statusPayload, ["message"], operation.error || "");

  return (
    <section className={`rounded-lg border bg-white p-5 shadow-sm ${failed ? "border-red-200" : completed ? "border-emerald-200" : "border-violet-200"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Icon name="pulse" className={`h-4 w-4 ${failed ? "text-red-600" : completed ? "text-emerald-600" : "text-violet-600"}`} />
            Restore Progress
          </h2>
          <p className="text-xs font-medium text-slate-500">
            {operation.workloadId} → {operation.targetClusterId}
          </p>
        </div>
        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-black ring-1 ${
          failed
            ? "bg-red-50 text-red-700 ring-red-200"
            : completed
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-violet-50 text-violet-700 ring-violet-200"
        }`}
        >
          {phase}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span>Velero Restore</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">
              {operation.restoreName}
            </span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                failed ? "bg-red-500" : completed ? "bg-emerald-500" : "bg-violet-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-black text-slate-500">
            <span>단계: {phase}</span>
            <span>{percent}%</span>
          </div>
          {message && (
            <div className={`mt-4 rounded-md border px-3 py-2 text-sm font-semibold ${
              failed ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
            >
              {message}
            </div>
          )}
        </div>

        <div className="grid gap-2 text-sm">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="block text-xs font-black uppercase text-slate-400">경과 시간</span>
            <strong className="text-slate-950">{formatDuration(elapsed)}</strong>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="block text-xs font-black uppercase text-slate-400">시작</span>
            <strong className="text-slate-950">{formatTime(startedAt)}</strong>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="block text-xs font-black uppercase text-slate-400">예상</span>
            <strong className="text-slate-950">{getRestoreEstimateLabel(phase, percent)}</strong>
          </div>
          <div className={`rounded-md border px-3 py-2 ${
            rtoMet === true
              ? "border-emerald-200 bg-emerald-50"
              : rtoMet === false
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-50"
          }`}
          >
            <span className="block text-xs font-black uppercase text-slate-400">RTO</span>
            <strong className="text-slate-950">
              {actualRto === null ? `진행 중 · 목표 ${rtoTarget}` : `${formatDuration(actualRto)} / 목표 ${rtoTarget}`}
            </strong>
          </div>
        </div>
      </div>

      {failed && (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span>복구 상태가 Failed입니다. 동일 워크로드는 승인 플로우에서 다시 시도할 수 있습니다.</span>
          <button
            type="button"
            onClick={() => onRetry(operation.workloadId)}
            className="inline-flex w-fit items-center justify-center rounded-md bg-red-700 px-3 py-2 text-xs font-black text-white transition hover:bg-red-800"
          >
            재시도
          </button>
        </div>
      )}

      {completed && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          복구 완료. 대상 클러스터가 Recovered 상태로 전환되었습니다.
        </div>
      )}
    </section>
  );
}

function getRtoHistoryEvents(payload) {
  return asArray(payload, ["history"]);
}

function formatRtoMinutes(minutes) {
  if (!Number.isFinite(minutes)) {
    return "-";
  }

  return formatDuration(minutes * 60 * 1000);
}

function hasRtoNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function formatRtoChartLabel(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getRtoStageOffset(event, timestamp) {
  if (!timestamp) {
    return "대기 중";
  }

  const startTime = new Date(event.alertDetectedAt || timestamp).getTime();
  const eventTime = new Date(timestamp).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(eventTime) || timestamp === event.alertDetectedAt) {
    return formatTime(timestamp);
  }

  return `+${formatDuration(eventTime - startTime)}`;
}

function getRtoTimelineStages(event) {
  return [
    ["장애 감지", "Prometheus Alert", event.alertDetectedAt, "bg-red-500"],
    ["AI 추천 생성 완료", "Recovery policy scoring", event.recommendationAt, "bg-sky-500"],
    ["운영자 승인", "Human-in-the-loop", event.approvedAt, "bg-emerald-500"],
    ["Velero Restore 시작", event.restoreName || "Restore accepted", event.restoreStartedAt, "bg-violet-500"],
    ["복구 완료", "Target cluster recovered", event.restoreCompletedAt, "bg-emerald-500"],
  ];
}

function getCurrentRtoMilliseconds(event, clock) {
  const start = event?.alertDetectedAt || event?.restoreStartedAt;
  const end = event?.restoreCompletedAt;

  if (!start) {
    return null;
  }

  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : clock;

  return Number.isFinite(startTime) && Number.isFinite(endTime) ? endTime - startTime : null;
}

function RtoHistoryChart({ events }) {
  const completedEvents = events
    .filter((event) => hasRtoNumber(event.actualRtoMinutes))
    .slice(0, 8)
    .reverse();

  if (completedEvents.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm font-semibold text-slate-500">
        복구 이력 없음
      </div>
    );
  }

  const width = 640;
  const height = 240;
  const padding = { top: 18, right: 28, bottom: 48, left: 50 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...completedEvents.flatMap((event) => [
      Number(event.actualRtoMinutes) || 0,
      hasRtoNumber(event.targetRtoMinutes) ? Number(event.targetRtoMinutes) : 0,
    ]),
  );
  const slot = plotWidth / completedEvents.length;
  const barWidth = Math.min(42, slot * 0.56);
  const yFor = (minutes) => padding.top + plotHeight - ((Number(minutes) || 0) / maxValue) * plotHeight;
  const targetPoints = completedEvents
    .map((event, index) => {
      if (!hasRtoNumber(event.targetRtoMinutes)) {
        return null;
      }

      const x = padding.left + (slot * index) + (slot / 2);
      return `${x},${yFor(event.targetRtoMinutes)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="RTO history actual versus target chart" className="min-w-[560px]">
        <line x1={padding.left} y1={padding.top + plotHeight} x2={width - padding.right} y2={padding.top + plotHeight} stroke="#cbd5e1" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke="#cbd5e1" />
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotHeight - (plotHeight * ratio);
          const label = Math.round(maxValue * ratio);

          return (
            <g key={ratio}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 6" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px] font-bold">
                {label}m
              </text>
            </g>
          );
        })}
        {targetPoints && (
          <polyline points={targetPoints} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="6 6" />
        )}
        {completedEvents.map((event, index) => {
          const x = padding.left + (slot * index) + ((slot - barWidth) / 2);
          const y = yFor(event.actualRtoMinutes);
          const barHeight = padding.top + plotHeight - y;
          const achieved = event.achieved === true;
          const exceeded = event.achieved === false;

          return (
            <g key={`${event.restoreName || event.namespace}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={achieved ? "#10b981" : exceeded ? "#ef4444" : "#64748b"}
              />
              <text x={x + (barWidth / 2)} y={Math.max(14, y - 6)} textAnchor="middle" className="fill-slate-700 text-[11px] font-black">
                {Number(event.actualRtoMinutes).toFixed(1)}m
              </text>
              <text
                x={x + (barWidth / 2)}
                y={height - 22}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-bold"
              >
                {formatRtoChartLabel(event.restoreCompletedAt || event.restoreStartedAt)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RtoMeasurementPanel({ history, loading, error, clock, onRefresh }) {
  const latest = history[0] || null;
  const currentRto = latest ? getCurrentRtoMilliseconds(latest, clock) : null;
  const targetMilliseconds = hasRtoNumber(latest?.targetRtoMinutes)
    ? Number(latest.targetRtoMinutes) * 60 * 1000
    : null;
  const achieved =
    latest?.actualRtoMinutes !== null && latest?.actualRtoMinutes !== undefined && targetMilliseconds !== null
      ? Number(latest.actualRtoMinutes) * 60 * 1000 <= targetMilliseconds
      : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Icon name="pulse" className="h-4 w-4 text-emerald-600" />
            RTO 타임라인{latest?.namespace ? ` · ${latest.namespace}` : ""}
          </h2>
          <p className="text-xs font-medium text-slate-500">장애 감지부터 대상 클러스터 복구 완료까지의 측정값</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex w-fit items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>

      {loading && (
        <div className="mt-5 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
          RTO 이력을 불러오는 중입니다.
        </div>
      )}

      {!loading && error && (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          RTO 이력을 불러오지 못했습니다. API 서버 상태를 확인하세요.
        </div>
      )}

      {!loading && !error && !latest && (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
          복구 이력 없음
        </div>
      )}

      {!loading && !error && latest && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <ol className="space-y-4">
              {getRtoTimelineStages(latest).map(([label, detail, timestamp, dotColor], index) => (
                <li key={label} className="grid grid-cols-[88px_1fr] gap-3">
                  <span className="pt-0.5 text-xs font-black text-slate-500">{getRtoStageOffset(latest, timestamp)}</span>
                  <div className="relative rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
                    {index < 4 && <i className="absolute -left-[48px] top-5 h-[calc(100%+16px)] w-px bg-slate-200" />}
                    <i className={`absolute -left-[52px] top-3 h-2.5 w-2.5 rounded-full ${timestamp ? dotColor : "bg-slate-300"} ring-4 ring-slate-50`} />
                    <strong className="block text-slate-950">{label}</strong>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-500">{timestamp ? detail : "아직 기록되지 않음"}</span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <span className="block text-xs font-black uppercase text-slate-400">실제 RTO</span>
                <strong className="text-slate-950">
                  {latest.actualRtoMinutes !== null && latest.actualRtoMinutes !== undefined
                    ? formatRtoMinutes(Number(latest.actualRtoMinutes))
                    : currentRto !== null
                      ? `${formatDuration(currentRto)} 진행 중`
                      : "-"}
                </strong>
              </div>
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <span className="block text-xs font-black uppercase text-slate-400">목표 RTO</span>
                <strong className="text-slate-950">
                  {hasRtoNumber(latest.targetRtoMinutes) ? formatRtoMinutes(Number(latest.targetRtoMinutes)) : "-"}
                </strong>
              </div>
              <div className={`rounded-md border px-3 py-2 ${
                achieved === true
                  ? "border-emerald-200 bg-emerald-50"
                  : achieved === false
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-white"
              }`}
              >
                <span className="block text-xs font-black uppercase text-slate-400">판정</span>
                <strong className="text-slate-950">{achieved === null ? "측정 중" : achieved ? "달성" : "초과"}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-950">RTO History</h3>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-500" />달성</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-red-500" />초과</span>
                <span className="inline-flex items-center gap-1"><i className="h-px w-5 border-t border-dashed border-slate-500" />목표</span>
              </div>
            </div>
            <RtoHistoryChart events={history} />
          </div>
        </div>
      )}
    </section>
  );
}

function RecoveryRecommendationPanel({
  recommendations,
  clusterId,
  loading,
  error,
  approvalError,
  isApproving,
  approvedWorkloads,
  rtoHistory,
  failedRestoreWorkloadId,
  restoreWorkloadId,
  hasActiveAlert,
  onApprove,
  onRefresh,
}) {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const hasRecoveryActivity = Boolean(restoreWorkloadId) || Object.keys(approvedWorkloads).length > 0;
  const shouldShowEmptyState = !loading && !error && !hasActiveAlert && !hasRecoveryActivity;
  const visibleRecommendations = shouldShowEmptyState ? [] : recommendations;
  const selectedRecommendation =
    visibleRecommendations.find((recommendation) => approvedWorkloads[getRecommendationWorkloadId(recommendation)]) ??
    visibleRecommendations[0];
  const selectedNamespace = selectedRecommendation ? getRecommendationWorkloadId(selectedRecommendation) : null;
  const selectedExplanation = selectedRecommendation
    ? firstValue(selectedRecommendation, ["explanation", "reason", "summary"], "AI 설명을 불러오지 못했습니다.")
    : null;
  const restoredNamespaces = useMemo(
    () => new Set(
      rtoHistory
        .filter((event) => event.restoreStartedAt || event.restoreCompletedAt)
        .map((event) => event.namespace),
    ),
    [rtoHistory],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Icon name="spark" className="h-4 w-4 text-sky-600" />
            AI Recovery Decision
          </h2>
          <p className="text-xs font-medium text-slate-500">복구 우선순위 추천 · {clusterId}</p>
        </div>
        <div className="flex gap-2">
          {visibleRecommendations.length > 0 && (
            <button
              type="button"
              disabled={isApproving || selectedItems.size === 0}
              onClick={() => onApprove(Array.from(selectedItems))}
              className="inline-flex w-fit items-center justify-center rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              선택 승인 ({selectedItems.size})
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex w-fit items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-5 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
          복구 우선순위 추천을 불러오는 중입니다.
        </div>
      )}

      {!loading && error && (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          추천 API를 사용할 수 없습니다. 서버 로그나 클러스터 capability를 확인하세요.
        </div>
      )}

      {!loading && approvalError && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          복구 요청을 완료하지 못했습니다. 잠시 후 다시 시도하세요.
        </div>
      )}

      {shouldShowEmptyState && (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          장애 이벤트 없음. 모니터링 중...
        </div>
      )}

      {!loading && !error && !shouldShowEmptyState && visibleRecommendations.length === 0 && (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          추천할 워크로드가 아직 없습니다. 정책 또는 워크로드 metric이 수집되면 목록이 표시됩니다.
        </div>
      )}

      {!loading && !error && !shouldShowEmptyState && visibleRecommendations.length > 0 && (
        <>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const unapproved = visibleRecommendations
                              .map(r => getRecommendationWorkloadId(r))
                              .filter(id => !approvedWorkloads[id] && !restoredNamespaces.has(id));
                            setSelectedItems(new Set(unapproved));
                          } else {
                            setSelectedItems(new Set());
                          }
                        }}
                        checked={
                          visibleRecommendations.length > 0 &&
                          visibleRecommendations.every(r => {
                            const id = getRecommendationWorkloadId(r);
                            return approvedWorkloads[id] || restoredNamespaces.has(id) || selectedItems.has(id);
                          }) &&
                          selectedItems.size > 0
                        }
                      />
                    </th>
                    <th className="w-16 px-4 py-3">순위</th>
                    <th className="min-w-[180px] px-4 py-3">네임스페이스</th>
                    <th className="w-24 px-4 py-3">점수</th>
                    <th className="w-28 px-4 py-3">티어</th>
                    <th className="min-w-[220px] px-4 py-3">AI 설명</th>
                    <th className="w-32 px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleRecommendations.map((recommendation, index) => {
                    const workloadId = getRecommendationWorkloadId(recommendation);
                    const failed = failedRestoreWorkloadId === workloadId;
                    const serverApproved = Boolean(firstValue(recommendation, ["approved"], false));
                    const approved = Boolean(approvedWorkloads[workloadId] || restoredNamespaces.has(workloadId)) && !failed;
                    const pending = isApproving && selectedItems.has(workloadId);
                    const tier = firstValue(recommendation, ["tier", "policyTier"], "unknown");
                    const score = firstValue(recommendation, ["score", "priorityScore"], 0);
                    const explanation = firstValue(recommendation, ["explanation", "reason", "summary"], "추천 설명 없음");

                    return (
                      <tr key={workloadId} className={approved ? "bg-emerald-50/50" : "bg-white"}>
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            disabled={approved}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-50"
                            checked={selectedItems.has(workloadId)}
                            onChange={(e) => {
                              const next = new Set(selectedItems);
                              if (e.target.checked) next.add(workloadId);
                              else next.delete(workloadId);
                              setSelectedItems(next);
                            }}
                          />
                        </td>
                        <td className="px-4 py-4 text-center font-black text-slate-900">
                          {getRecommendationRank(recommendation, index)}
                        </td>
                        <td className="px-4 py-4 font-black text-slate-950">{workloadId}</td>
                        <td className="px-4 py-4 font-black text-slate-900">{score}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-700 ring-1 ring-slate-200">
                            {tier}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold leading-5 text-slate-600">
                          {explanation}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            {approved && (
                              <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
                                승인됨
                              </span>
                            )}
                            {!approved && serverApproved && (
                              <span className="inline-flex w-max whitespace-nowrap rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-black text-sky-800 ring-1 ring-sky-200">
                                승인됨/복구대기
                              </span>
                            )}
                            {failed && (
                              <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-800 ring-1 ring-red-200">
                                실패
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={approved || isApproving}
                              onClick={() => onApprove([workloadId])}
                              className={`rounded-md px-3 py-2 text-sm font-black transition ${
                                approved
                                  ? "cursor-not-allowed bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                                  : "bg-slate-950 text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                              }`}
                            >
                              {approved ? "완료" : isApproving && selectedItems.has(workloadId) ? "실행 중" : failed ? "재시도" : serverApproved ? "복구 실행" : "승인"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selectedExplanation && (
            <div className="mt-5 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
              <h3 className="text-sm font-black text-sky-950">AI 설명 ({selectedNamespace}):</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-sky-900/80">{selectedExplanation}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ClusterList({ clusters, activeClusterId, onSelect, onDelete }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-950">Connected Clusters</h2>
          <p className="text-xs font-medium text-slate-500">클러스터를 선택하면 토폴로지가 갱신됩니다.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
          {clusters.length}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {clusters.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold leading-6 text-slate-600">
            이 토큰에 연결된 클러스터가 아직 없습니다. dr-agent 등록이 완료되면 여기에 표시됩니다.
          </div>
        )}

        {clusters.map((cluster) => {
          const isActive = cluster.id === activeClusterId;

          return (
            <button
              key={cluster.id}
              type="button"
              onClick={() => onSelect(cluster.id)}
              className={`rounded-lg border p-4 text-left transition ${
                isActive
                  ? "border-sky-300 bg-sky-50 shadow-sm ring-2 ring-sky-100"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-950">{cluster.name}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {cluster.provider} · {cluster.region}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${cluster.statusBadge}`}>
                    <span className={`h-2 w-2 rounded-full ${cluster.statusDot}`} />
                    {cluster.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(cluster.id);
                    }}
                    className="rounded text-[11px] font-bold text-red-500 hover:bg-red-50 hover:text-red-600 px-2 py-1 border border-red-200 transition"
                    title="영구 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <span className="rounded-md bg-slate-50 px-2 py-2 ring-1 ring-slate-200">
                  <b className="block text-xs text-slate-400">RTO</b>
                  <strong className="text-sm text-slate-900">{cluster.rto}</strong>
                </span>
                <span className="rounded-md bg-slate-50 px-2 py-2 ring-1 ring-slate-200">
                  <b className="block text-xs text-slate-400">RPO</b>
                  <strong className="text-sm text-slate-900">{cluster.rpo}</strong>
                </span>
                <span className="rounded-md bg-slate-50 px-2 py-2 ring-1 ring-slate-200">
                  <b className="block text-xs text-slate-400">Impact</b>
                  <strong className="text-sm text-slate-900">{cluster.impact}</strong>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function Dashboard() {
  const [dashboardToken] = useState(() => initializeDashboardToken());
  const [activeClusterId, setActiveClusterId] = useState(clusterScenarios[0].id);
  const [topologyTab, setTopologyTab] = useState("architecture");
  const [apiResults, setApiResults] = useState(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [pendingWorkloadId, setPendingWorkloadId] = useState(null);
  const [approvedWorkloads, setApprovedWorkloads] = useState({});
  const [restoreWorkloadId, setRestoreWorkloadId] = useState(null);
  const [recoveredWorkloadId, setRecoveredWorkloadId] = useState(null);
  const [restoreOperation, setRestoreOperation] = useState(null);
  const [restoreClock, setRestoreClock] = useState(Date.now());
  const [rtoHistory, setRtoHistory] = useState([]);
  const [rtoLoading, setRtoLoading] = useState(true);
  const [rtoError, setRtoError] = useState(null);
  const [rtoReloadNonce, setRtoReloadNonce] = useState(0);
  const [approvalError, setApprovalError] = useState(null);
  const [alertEvents, setAlertEvents] = useState([]);
  const [eventClock, setEventClock] = useState(Date.now());
  const [eventPollingError, setEventPollingError] = useState(null);
  const nodeTypes = useMemo(() => ({ drNode: DisasterRecoveryNode }), []);
  const edgeTypes = useMemo(() => ({ labeled: LabeledFlowEdge }), []);
  const alertTopologyState = useMemo(() => getAlertTopologyState(alertEvents, eventClock), [alertEvents, eventClock]);
  const dashboardClusters = useMemo(() => buildDashboardClusters(apiResults, apiLoading, alertEvents), [apiResults, apiLoading, alertEvents]);
  const metricGroups = useMemo(() => buildMetricGroups(apiResults, apiLoading), [apiResults, apiLoading]);
  const recommendations = useMemo(() => getRecoveryRecommendations(apiResults), [apiResults]);
  const restorePhase = getRestorePhase(restoreOperation);
  const restoreRecovered = Boolean(recoveredWorkloadId && (!restoreOperation || restorePhase === "Completed"));
  const failedRestoreWorkloadId = restorePhase === "Failed" ? restoreOperation?.workloadId : null;
  const incidentStartedAt = useMemo(() => getIncidentStartedAt(alertEvents), [alertEvents]);
  const activeCluster = useMemo(
    () => dashboardClusters.find((cluster) => cluster.id === activeClusterId) ?? dashboardClusters[0] ?? clusterScenarios[0],
    [activeClusterId, dashboardClusters],
  );
  const activeNodes = useMemo(
    () =>
      baseFlowNodes.map((node) => ({
        ...node,
        data: {
          ...applyAlertTopologyToNode(
            node.id,
            {
              ...node.data,
              ...(activeCluster.nodeOverrides[node.id] ?? {}),
            },
            alertTopologyState,
            pendingWorkloadId,
            restoreWorkloadId,
            restoreRecovered,
          ),
        },
      })),
    [activeCluster, alertTopologyState, pendingWorkloadId, restoreWorkloadId, restoreRecovered],
  );
  const activeEdges = useMemo(
    () => buildAlertAwareEdges(flowEdges, getEdgeFlowState(alertTopologyState, activeCluster, restoreWorkloadId, restoreRecovered)),
    [activeCluster, alertTopologyState, restoreWorkloadId, restoreRecovered],
  );
  const apiErrors = endpointErrors(apiResults);
  const validateErrors = validationErrors(apiResults);
  const apiIssueCount = apiErrors.length + validateErrors.length + (eventPollingError ? 1 : 0);
  const recommendationError = getApiError(apiResults, "cloudRecommendations");

  useEffect(() => {
    if (!dashboardToken) {
      setApiLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    setApiLoading(true);
    loadDashboardData({ signal: controller.signal })
      .then((results) => {
        setApiResults(results);
        setAlertEvents(extractAlertEvents(results.eventHistory?.ok ? results.eventHistory.data : null));
        setEventClock(Date.now());
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setApiResults({
            fatal: {
              ok: false,
              error: `Dashboard API load failed: ${error.message}`,
            },
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setApiLoading(false);
        }
      });

    return () => controller.abort();
  }, [dashboardToken, reloadNonce]);

  useEffect(() => {
    if (!dashboardToken) {
      setRtoLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    setRtoLoading(true);
    loadRtoHistory(activeCluster.id, { signal: controller.signal })
      .then((payload) => {
        setRtoHistory(getRtoHistoryEvents(payload));
        setRtoError(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setRtoError(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRtoLoading(false);
        }
      });

    return () => controller.abort();
  }, [dashboardToken, activeCluster.id, rtoReloadNonce]);

  useEffect(() => {
    if (!dashboardToken) {
      return undefined;
    }

    let active = true;
    let controller = null;

    async function pollEvents() {
      const requestController = new AbortController();
      controller = requestController;

      try {
        const payload = await loadLatestEvent({ signal: requestController.signal });
        const latestEvents = extractAlertEvents(payload);

        if (active) {
          setAlertEvents((events) => mergeAlertEvents(events, latestEvents));
          setEventClock(Date.now());
          setEventPollingError(null);
        }
      } catch (error) {
        if (active && !requestController.signal.aborted) {
          setEventPollingError(error.message);
        }
      }
    }

    pollEvents();
    const intervalId = window.setInterval(pollEvents, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, [dashboardToken]);

  useEffect(() => {
    if (!restoreOperation) {
      return undefined;
    }

    const intervalId = window.setInterval(() => setRestoreClock(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, [restoreOperation]);

  useEffect(() => {
    if (!dashboardToken || !restoreOperation?.restoreName || isTerminalRestorePhase(getRestorePhase(restoreOperation))) {
      return undefined;
    }

    let active = true;
    let controller = null;

    async function pollRestoreStatus() {
      const requestController = new AbortController();
      controller = requestController;

      try {
        const payload = await loadRestoreStatus(restoreOperation.targetClusterId, restoreOperation.restoreName, {
          signal: requestController.signal,
        });
        const phase = firstValue(payload, ["restore.status", "restore.phase", "status", "phase"], restoreOperation.phase || "PendingAgent");
        const completedAt = firstValue(payload, ["restore.completionTimestamp"], null);

        if (active) {
          setRestoreOperation((current) => {
            if (!current || current.restoreName !== restoreOperation.restoreName) {
              return current;
            }

            return {
              ...current,
              phase,
              statusPayload: payload,
              completedAt: isTerminalRestorePhase(phase) ? completedAt || new Date().toISOString() : null,
              error: null,
            };
          });

          if (phase === "Completed") {
            setRecoveredWorkloadId(restoreOperation.workloadId);
            setRtoReloadNonce((value) => value + 1);
          }
        }
      } catch (error) {
        if (active && !requestController.signal.aborted) {
          setRestoreOperation((current) => {
            if (!current || current.restoreName !== restoreOperation.restoreName) {
              return current;
            }

            return {
              ...current,
              error: error.message,
            };
          });
        }
      }
    }

    pollRestoreStatus();
    const intervalId = window.setInterval(pollRestoreStatus, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, [dashboardToken, restoreOperation?.restoreName, restoreOperation?.targetClusterId, restoreOperation?.phase]);

  useEffect(() => {
    if (restorePhase !== "Completed" || !restoreOperation?.restoreName) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRestoreOperation((current) => (
        current?.restoreName === restoreOperation.restoreName ? null : current
      ));
    }, 60000);

    return () => window.clearTimeout(timeoutId);
  }, [restorePhase, restoreOperation?.restoreName]);

  async function handleApproveRecommendation(workloadIds) {
    const workloads = Array.isArray(workloadIds) ? workloadIds : [workloadIds];
    const retryingFailedRestore = restoreOperation?.workloadId === workloads[0] && getRestorePhase(restoreOperation) === "Failed";
    const pendingWorkloads = workloads.filter((id) => !approvedWorkloads[id] || retryingFailedRestore);

    if (pendingWorkloads.length === 0) {
      return;
    }

    const targetLabel = activeCluster.isAgentCluster ? activeCluster.name : "Edge K3s";
    const confirmed = window.confirm(`이 작업은 ${targetLabel}에 ${pendingWorkloads.length}개의 복구를 실행합니다. 계속하시겠습니까?`);

    if (!confirmed) {
      return;
    }

    setPendingWorkloadId(pendingWorkloads[0]);
    setApprovalError(null);
    setRecoveredWorkloadId(null);

    try {
      for (const id of pendingWorkloads) {
        await approveRecoveryRecommendation(activeCluster.id, id);
      }
      const targetClusterId = activeCluster.isAgentCluster ? activeCluster.id : "edge-recovery";
      const restoreResponse = await executeRecoveryRestore(activeCluster.id, pendingWorkloads, { targetClusterId });
      const restore = firstValue(restoreResponse, ["restore"], {});
      const restoreName = firstValue(restoreResponse, ["restore.restoreName", "requestedRestoreName"], `${pendingWorkloads[0]}-restore`);
      const resolvedTargetClusterId = firstValue(restoreResponse, ["targetClusterId", "requestedTargetClusterId"], targetClusterId);
      const acceptedAt = firstValue(restoreResponse, ["acceptedTimestamp", "restore.createdTimestamp"], new Date().toISOString());
      const phase = firstValue(restoreResponse, ["restore.status", "restore.phase"], "PendingAgent");

      setApprovedWorkloads((workloads) => {
        const next = { ...workloads };
        pendingWorkloads.forEach(id => { next[id] = true; });
        return next;
      });
      setRestoreWorkloadId(pendingWorkloads[0]);
      setRestoreOperation({
        workloadId: pendingWorkloads[0],
        restoreName,
        targetClusterId: resolvedTargetClusterId,
        acceptedAt,
        startedAt: firstValue(restore, ["startTimestamp", "createdTimestamp"], acceptedAt),
        completedAt: null,
        phase,
        statusPayload: restoreResponse,
        error: null,
      });
      setRestoreClock(Date.now());
      setReloadNonce((value) => value + 1);
      setRtoReloadNonce((value) => value + 1);
    } catch (error) {
      setApprovalError(error.message);
    } finally {
      setPendingWorkloadId(null);
    }
  }

  useEffect(() => {
    if (!dashboardClusters.some((cluster) => cluster.id === activeClusterId)) {
      setActiveClusterId(dashboardClusters[0]?.id ?? clusterScenarios[0].id);
    }
  }, [activeClusterId, dashboardClusters]);

  if (requireDashboardToken && !dashboardToken) {
    return <RegistrationGuidance />;
  }

  const handleDeleteCluster = async (clusterId) => {
    if (window.confirm("정말 이 클러스터를 대시보드에서 영구적으로 삭제하시겠습니까?")) {
      try {
        await deleteCluster(clusterId);
        window.location.reload();
      } catch (err) {
        alert("삭제 중 오류가 발생했습니다: " + err.message);
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-5 px-5 py-5 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ${activeCluster.statusBadge}`}>
                <Icon name="warning" className="h-4 w-4" />
                {activeCluster.environment} · {activeCluster.status}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                {activeCluster.updatedAt}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-normal text-slate-950 md:text-3xl">
              {activeCluster.name} DR Monitoring
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
              {activeCluster.description}
            </p>
            {(apiLoading || apiIssueCount > 0) && (
              <div
                className={`mt-3 max-w-3xl rounded-md border px-3 py-2 text-xs font-semibold ${
                  apiLoading
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {apiLoading
                  ? "Live API 데이터를 불러오는 중입니다."
                  : `일부 API 응답 또는 클러스터 검증을 사용할 수 없습니다. 안전한 오류 상태로 표시 중입니다. (${apiIssueCount})`}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-[460px]">
            <MetricCard label="RTO Target" value={activeCluster.rto} tone="text-violet-600" />
            <MetricCard label="RPO" value={activeCluster.rpo} tone="text-emerald-600" />
            <MetricCard label="Impact" value={activeCluster.impact} tone="text-red-600" />
          </div>
        </header>

        <section className="grid min-h-[720px] flex-1 grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <ClusterList
            clusters={dashboardClusters}
            activeClusterId={activeCluster.id}
            onSelect={setActiveClusterId}
            onDelete={handleDeleteCluster}
          />

          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setTopologyTab("architecture")}
                    className={`text-sm font-black pb-1 border-b-2 ${topologyTab === "architecture" ? "border-indigo-600 text-slate-950" : "border-transparent text-slate-400"}`}
                  >
                    Architecture Flow
                  </button>
                  <button 
                    onClick={() => setTopologyTab("user-cluster")}
                    className={`text-sm font-black pb-1 border-b-2 ${topologyTab === "user-cluster" ? "border-indigo-600 text-slate-950" : "border-transparent text-slate-400"}`}
                  >
                    User Cluster Map
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  {activeCluster.provider} · {activeCluster.region} · {topologyTab === "architecture" ? "Architecture workflow" : "Live cluster topology"}
                </p>
              </div>
              <div className="hidden items-center gap-3 text-xs font-bold text-slate-500 md:flex">
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" />Outage</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Backup safe</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" />Restore</span>
              </div>
            </div>

            <div className={`${topologyTab === "user-cluster" ? "h-[860px]" : "h-[660px]"} w-full bg-slate-50`}>
              {topologyTab === "architecture" ? (
              <ReactFlow
                key={activeCluster.id}
                nodes={activeNodes}
                edges={activeEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.22, minZoom: 0.25, maxZoom: 0.95 }}
                minZoom={0.25}
                maxZoom={1.45}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#cbd5e1" gap={22} size={1.2} />
                <Controls
                  showInteractive={false}
                  className="!rounded-lg !border !border-slate-200 !bg-white !shadow-sm"
                />
                <Panel position="top-left" className="rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                    <Icon name="shield" className="h-4 w-4 text-sky-600" />
                    Policy: {activeCluster.policy}
                  </div>
                </Panel>
              </ReactFlow>
            ) : (
              <UserClusterTopology
                apiResults={apiResults}
                activeCluster={activeCluster}
                alertEvents={alertEvents}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
              />
            )}
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-black text-slate-950">Incident Stream</h2>
                <p className="text-xs font-medium text-slate-500">{activeCluster.name} event timeline</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200">LIVE</span>
            </div>

            <ol className="mt-5 space-y-4">
              {activeCluster.stream.map(([time, text, dotColor]) => (
                <li key={`${time}-${text}`} className="grid grid-cols-[76px_1fr] gap-3">
                  <span className="pt-0.5 text-xs font-bold text-slate-400">{time}</span>
                  <span className="relative rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <i className={`absolute -left-[18px] top-3 h-2.5 w-2.5 rounded-full ${dotColor} ring-4 ring-white`} />
                    {text}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-6 rounded-lg border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-violet-900">
                <Icon name="spark" className="h-5 w-5 text-violet-600" />
                AI Recovery Decision
              </div>
              <p className="mt-2 text-sm font-medium leading-6 text-violet-900/75">
                {activeCluster.decision}
              </p>
            </div>
          </aside>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {metricGroups.map((group) => (
            <MetricGraphPanel key={group.title} group={group} />
          ))}
        </section>

        <RestoreProgressPanel
          operation={restoreOperation}
          clock={restoreClock}
          incidentStartedAt={incidentStartedAt}
          rtoTarget={activeCluster.rto}
          onRetry={handleApproveRecommendation}
        />

        <RtoMeasurementPanel
          history={rtoHistory}
          loading={rtoLoading}
          error={rtoError}
          clock={restoreClock}
          onRefresh={() => setRtoReloadNonce((value) => value + 1)}
        />

        <RecoveryRecommendationPanel
          recommendations={recommendations}
          clusterId={activeCluster.id}
          loading={apiLoading}
          error={recommendationError}
          approvalError={approvalError}
          isApproving={Boolean(pendingWorkloadId)}
          approvedWorkloads={approvedWorkloads}
          rtoHistory={rtoHistory}
          failedRestoreWorkloadId={failedRestoreWorkloadId}
          restoreWorkloadId={restoreWorkloadId}
          hasActiveAlert={alertTopologyState.hasFiring}
          onApprove={handleApproveRecommendation}
          onRefresh={() => setReloadNonce((value) => value + 1)}
        />
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/download" element={<DownloadPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;

function getNamespaceStatus(namespace, health, alertEvents) {
  const alert = alertEvents
    .map(normalizeAlertEvent)
    .find((event) => event.status === "firing" && event.namespace === namespace);

  if (alert) {
    const critical = alert.severity === "critical";

    return {
      status: critical ? "outage" : "warning",
      detail: `${alert.alertname} firing for ${namespace}`,
      pulse: critical,
      source: "Alertmanager",
    };
  }

  if (toNumber(health.failedPods) > 0) {
    return {
      status: "outage",
      detail: `${health.failedPods} failed pods reported`,
      pulse: true,
      source: "Workload health",
    };
  }

  if (toNumber(health.pendingPods) > 0 || toNumber(health.unknownPods) > 0) {
    return {
      status: "warning",
      detail: `${toNumber(health.pendingPods) + toNumber(health.unknownPods)} pods need attention`,
      pulse: false,
      source: "Workload health",
    };
  }

  if (firstValue(health, ["perNamespaceMetricsUnavailable"], false)) {
    return {
      status: "safe",
      detail: "Namespace discovered; per-namespace pod metrics pending",
      pulse: false,
      source: "Live agent",
    };
  }

  return {
    status: "safe",
    detail: "Namespace connection and workload signal are normal",
    pulse: false,
    source: "Live agent",
  };
}

function getClusterMapStatus(activeCluster, alertEvents) {
  const clusterAlert = alertEvents
    .map(normalizeAlertEvent)
    .find((event) => event.status === "firing" && !event.namespace && event.clusterId === activeCluster.id);

  if (clusterAlert) {
    const critical = clusterAlert.severity === "critical";

    return {
      status: critical ? "outage" : "warning",
      detail: `${clusterAlert.alertname} firing for ${activeCluster.id}`,
      pulse: critical,
    };
  }

  if (activeCluster.status === "Incident") {
    return {
      status: "outage",
      detail: "Cluster health is reporting an active incident",
      pulse: true,
    };
  }

  if (activeCluster.status === "Warning") {
    return {
      status: "warning",
      detail: "Agent connected, but workloads or heartbeat need attention",
      pulse: false,
    };
  }

  return {
    status: "safe",
    detail: "Agent connection is healthy",
    pulse: false,
  };
}

function buildNamespaceHealthRows(apiResults, alertEvents = []) {
  const workloads = getApiResult(apiResults, "cloudWorkloads");
  const healthRows = asArray(workloads, ["summary.namespaceHealth"]);
  const totalPods = toNumber(firstValue(workloads, ["summary.totalPods"], 0));
  const healthRowsHavePodCounts = healthRows.some((row) => toNumber(firstValue(row, ["totalPods"], 0)) > 0);
  const normalizeRows = (rows) => rows.map((row) => (
    totalPods > 0 && !healthRowsHavePodCounts
      ? {
        ...row,
        totalPods: null,
        runningPods: null,
        pendingPods: null,
        failedPods: null,
        succeededPods: null,
        unknownPods: null,
        perNamespaceMetricsUnavailable: true,
      }
      : row
  ));
  const alertNamespaces = alertEvents
    .map(normalizeAlertEvent)
    .filter((event) => event.namespace && event.status === "firing")
    .map((event) => event.namespace);
  const appendMissingAlertNamespaces = (rows) => {
    const seen = new Set(rows.map((row) => row.namespace));
    const missing = [...new Set(alertNamespaces)]
      .filter((namespace) => !seen.has(namespace))
      .map((namespace) => ({
        namespace,
        totalPods: null,
        runningPods: null,
        pendingPods: null,
        failedPods: null,
        succeededPods: null,
        unknownPods: null,
        signalOnly: true,
      }));

    return [...missing, ...rows];
  };

  if (healthRows.length) {
    return appendMissingAlertNamespaces(normalizeRows(healthRows));
  }

  return appendMissingAlertNamespaces(asArray(workloads, ["summary.namespaces"]).map((item) => ({
    namespace: firstValue(item, ["namespace"], "default"),
    totalPods: firstValue(item, ["podCount"], 0),
    runningPods: null,
    pendingPods: null,
    failedPods: null,
    succeededPods: null,
    unknownPods: null,
  })));
}

function formatNamespaceMetric(value) {
  return value === null || value === undefined ? "-" : String(value);
}

function getNamespaceStatusWeight(status) {
  if (status === "outage") return 3;
  if (status === "warning") return 2;
  if (status === "recovered") return 1;
  return 0;
}

function getNamespaceSummary(records) {
  const outageCount = records.filter((record) => record.status.status === "outage").length;
  const warningCount = records.filter((record) => record.status.status === "warning").length;
  const worstStatus = outageCount ? "outage" : warningCount ? "warning" : "safe";

  return {
    status: worstStatus,
    detail: outageCount
      ? `${outageCount} namespace incidents hidden`
      : warningCount
        ? `${warningCount} namespace warnings hidden`
        : `${records.length} namespaces collapsed`,
    metrics: [
      ["Total", String(records.length)],
      ["Outage", String(outageCount)],
      ["Warning", String(warningCount)],
    ],
  };
}

function UserClusterTopology({ apiResults, activeCluster, alertEvents, nodeTypes, edgeTypes }) {
  const topology = getApiResult(apiResults, "cloudTopology");
  const [showNamespaces, setShowNamespaces] = useState(false);
  const namespaceHealthRows = useMemo(() => buildNamespaceHealthRows(apiResults, alertEvents), [apiResults, alertEvents]);
  const namespaceRecords = useMemo(
    () => namespaceHealthRows
      .map((health, index) => {
        const namespace = firstValue(health, ["namespace"], `namespace-${index + 1}`);
        const status = getNamespaceStatus(namespace, health, alertEvents);

        return { health, namespace, status };
      })
      .sort((left, right) => (
        getNamespaceStatusWeight(right.status.status) - getNamespaceStatusWeight(left.status.status) ||
        left.namespace.localeCompare(right.namespace)
      )),
    [namespaceHealthRows, alertEvents],
  );
  
  const nodes = useMemo(() => {
    if (!activeCluster) return [];

    const topologyNodes = asArray(topology, ["nodes"]);
    const clusterTopologyNode =
      topologyNodes.find((node) => node.id === activeCluster.id) ??
      topologyNodes.find((node) => node.selected) ??
      topologyNodes[0];
    const clusterStatus = getClusterMapStatus(activeCluster, alertEvents);
    const clusterNode = {
      id: activeCluster.id,
      type: "drNode",
      position: { x: showNamespaces ? 380 : 260, y: showNamespaces ? 30 : 160 },
      data: {
        icon: firstValue(clusterTopologyNode, ["type"], activeCluster.isAgentCluster ? "user-k8s" : "cloud-k8s") === "edge-k3s" ? "edge" : "cloud",
        label: firstValue(clusterTopologyNode, ["label"], activeCluster.name),
        subtitle: firstValue(clusterTopologyNode, ["type"], activeCluster.isAgentCluster ? "user-k8s" : "cluster"),
        status: clusterStatus.status,
        detail: clusterStatus.detail,
        pulse: clusterStatus.pulse,
        metrics: [
          ["IP", firstValue(clusterTopologyNode, ["nodeIp"], activeCluster.region || "N/A")],
          ["Node", firstValue(clusterTopologyNode, ["nodeName"], "N/A")],
          ["Namespaces", String(namespaceHealthRows.length)],
        ],
      },
    };

    if (!showNamespaces) {
      const summary = getNamespaceSummary(namespaceRecords);

      return [clusterNode, {
        id: "namespace-summary",
        type: "drNode",
        position: { x: 620, y: 160 },
        data: {
          icon: "database",
          label: "Namespaces",
          subtitle: "Collapsed namespace map",
          status: summary.status,
          detail: summary.detail,
          pulse: summary.status === "outage",
          metrics: summary.metrics,
        },
      }];
    }

    const namespaceNodes = namespaceRecords.slice(0, 15).map((record, index) => {
      const { health, namespace, status } = record;
      const columns = 2;
      const column = index % columns;
      const row = Math.floor(index / columns);

      return {
        id: `namespace-${namespace}`,
        type: "drNode",
        position: { x: 160 + (column * 440), y: 330 + (row * 340) },
        data: {
          icon: "database",
          label: namespace,
          subtitle: "Namespace",
          status: status.status,
          detail: status.detail,
          pulse: status.pulse,
          metrics: [
            ["Pods", firstValue(health, ["signalOnly"], false) ? "No pod metric" : formatNamespaceMetric(firstValue(health, ["totalPods"], null))],
            ["Running", formatNamespaceMetric(firstValue(health, ["runningPods"], null))],
            ["Failed", formatNamespaceMetric(firstValue(health, ["failedPods"], null))],
            ["Source", status.source],
          ],
        },
      };
    });

    return [clusterNode, ...namespaceNodes];
  }, [activeCluster, topology, namespaceHealthRows.length, namespaceRecords, alertEvents, showNamespaces]);

  const edges = useMemo(() => {
    if (!activeCluster) return [];

    return nodes
      .filter((node) => node.id === "namespace-summary" || node.id.startsWith("namespace-"))
      .map((node) => {
        const alerting = ["outage", "warning"].includes(node.data.status);
        const stroke = node.data.status === "outage" ? "#ef4444" : node.data.status === "warning" ? "#f59e0b" : "#10b981";

        return {
          id: `${activeCluster.id}-${node.id}`,
          source: activeCluster.id,
          target: node.id,
      type: "labeled",
          animated: alerting,
          label: node.id === "namespace-summary" ? "namespace-map" : alerting ? "incident-scope" : "namespace",
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          style: { stroke, strokeWidth: alerting ? 2.8 : 1.8 },
          data: { labelOffset: { x: 0, y: -18 }, labelTone: alerting ? "warning" : "neutral" },
        };
      });
  }, [activeCluster, nodes]);

  if (!activeCluster || nodes.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">No live topology data available</div>;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.18, minZoom: 0.45, maxZoom: 0.95 }}
      minZoom={0.35}
      maxZoom={1.35}
      nodesDraggable={false}
      nodesConnectable={false}
    >
      <Background color="#94a3b8" gap={18} size={1.25} variant="dots" />
      <Controls showInteractive={false} />
      <Panel position="top-right" className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setShowNamespaces((value) => !value)}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          {showNamespaces ? "네임스페이스 접기" : `네임스페이스 펼치기 (${namespaceRecords.length})`}
        </button>
      </Panel>
    </ReactFlow>
  );
}
