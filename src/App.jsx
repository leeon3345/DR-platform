import { useEffect, useMemo, useState } from "react";
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
import { loadDashboardData } from "./api";

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
  safe: {
    label: "Safe",
    text: "Protected",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500 shadow-emerald-500/40",
    icon: "bg-emerald-500 text-white",
    border: "border-emerald-200",
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
  restoring: {
    label: "Restoring",
    text: "Failover",
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    dot: "bg-violet-500 shadow-violet-500/40",
    icon: "bg-violet-500 text-white",
    border: "border-violet-200",
    glow: "shadow-violet-500/10",
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
      ["02:14:11", "Zabbix가 Webhook Alert 전송", "bg-amber-500"],
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
      zabbix: {
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
      ["02:09:24", "Zabbix가 Warning Trigger 수집", "bg-amber-500"],
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
      zabbix: {
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
      ["02:02:16", "Zabbix heartbeat 수신", "bg-emerald-500"],
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
      zabbix: {
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
    id: "zabbix",
    type: "drNode",
    position: { x: 430, y: 42 },
    data: {
      icon: "pulse",
      label: "Zabbix",
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
    id: "cloud-to-zabbix",
    source: "cloud-k8s",
    sourceHandle: "right",
    target: "zabbix",
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
    id: "zabbix-to-ai",
    source: "zabbix",
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

function buildLiveStream(apiResults, apiLoading, fallbackStream) {
  if (apiLoading) {
    return [["Live", "Backend status APIs loading", "bg-sky-500"], ...fallbackStream.slice(0, 4)];
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

  return rows.length ? rows : fallbackStream;
}

function buildDashboardClusters(apiResults, apiLoading) {
  const apiClusters = asArray(getApiResult(apiResults, "clusters"), ["clusters", "items"]);
  const overallStatus = deriveOverallStatus(apiResults, apiLoading);
  const statusMeta = getStatusMeta(overallStatus);
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
    zabbix: {
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

        return {
          ...template,
          id: firstValue(cluster, ["id", "name", "metadata.name"], template.id),
          name: firstValue(cluster, ["displayName", "name", "metadata.name", "id"], template.name),
          provider: firstValue(cluster, ["provider", "kind", "clusterKind", "type", "distribution"], template.provider),
          region: firstValue(cluster, ["region", "location", "nodeIp"], template.region),
          environment: firstValue(cluster, ["environment", "env"], template.environment),
        };
      })
    : clusterScenarios;

  return sourceClusters.map((cluster) => ({
    ...cluster,
    ...statusMeta,
    status: overallStatus,
    updatedAt: apiLoading ? "Loading live API data" : safeErrors.length || validationIssues.length ? "Live API partial warning" : "Live API synced",
    description: apiLoading
      ? "TASK-02 백엔드 API에서 Cloud, Edge, MinIO, Velero 상태를 불러오는 중입니다."
      : "Registry-backed API 응답을 기반으로 Cloud K8s, Edge K3s, MinIO, Velero 상태를 표시합니다.",
    stream: buildLiveStream(apiResults, apiLoading, cluster.stream),
    nodeOverrides: {
      ...cluster.nodeOverrides,
      ...liveNodeOverrides,
    },
  }));
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
  const status = statusStyles[data.status];

  return (
    <div
      className={`w-[260px] rounded-lg border ${status.border} bg-white shadow-xl ${status.glow} transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl`}
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

function ClusterList({ clusters, activeClusterId, onSelect }) {
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
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${cluster.statusBadge}`}>
                  <span className={`h-2 w-2 rounded-full ${cluster.statusDot}`} />
                  {cluster.status}
                </span>
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

function App() {
  const [activeClusterId, setActiveClusterId] = useState(clusterScenarios[0].id);
  const [apiResults, setApiResults] = useState(null);
  const [apiLoading, setApiLoading] = useState(true);
  const nodeTypes = useMemo(() => ({ drNode: DisasterRecoveryNode }), []);
  const edgeTypes = useMemo(() => ({ labeled: LabeledFlowEdge }), []);
  const dashboardClusters = useMemo(() => buildDashboardClusters(apiResults, apiLoading), [apiResults, apiLoading]);
  const activeCluster = useMemo(
    () => dashboardClusters.find((cluster) => cluster.id === activeClusterId) ?? dashboardClusters[0],
    [activeClusterId, dashboardClusters],
  );
  const activeNodes = useMemo(
    () =>
      baseFlowNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          ...(activeCluster.nodeOverrides[node.id] ?? {}),
        },
      })),
    [activeCluster],
  );
  const apiErrors = endpointErrors(apiResults);
  const validateErrors = validationErrors(apiResults);
  const apiIssueCount = apiErrors.length + validateErrors.length;

  useEffect(() => {
    const controller = new AbortController();

    setApiLoading(true);
    loadDashboardData({ signal: controller.signal })
      .then((results) => {
        setApiResults(results);
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
  }, []);

  useEffect(() => {
    if (!dashboardClusters.some((cluster) => cluster.id === activeClusterId)) {
      setActiveClusterId(dashboardClusters[0]?.id ?? clusterScenarios[0].id);
    }
  }, [activeClusterId, dashboardClusters]);

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
          />

          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">Recovery Flow Topology</h2>
                <p className="text-xs font-medium text-slate-500">
                  {activeCluster.provider} · {activeCluster.region} · selected cluster topology
                </p>
              </div>
              <div className="hidden items-center gap-3 text-xs font-bold text-slate-500 md:flex">
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" />Outage</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Backup safe</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" />Restore</span>
              </div>
            </div>

            <div className="h-[660px] w-full bg-slate-50">
              <ReactFlow
                key={activeCluster.id}
                nodes={activeNodes}
                edges={flowEdges}
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
      </div>
    </main>
  );
}

export default App;
