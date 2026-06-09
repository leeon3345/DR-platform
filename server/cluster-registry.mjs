import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sshDefaults } from './lab-config.mjs';

const defaultRegistryPath = fileURLToPath(new URL('./registry/clusters.json', import.meta.url));
const registryPath = process.env.DR_CLUSTER_REGISTRY_PATH || defaultRegistryPath;
const supportedKinds = new Set(['cloud-k8s', 'edge-k3s', 'user-k8s']);
const supportedAccessModes = new Set(['kubectl', 'k3s', 'agent']);
const idPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const nodeNamePattern = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;

export class RegistryError extends Error {
  constructor(message, { code = 'REGISTRY_ERROR', statusCode = 400, details = {} } = {}) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function listClusterProfiles() {
  return readRegistry();
}

export async function getClusterProfile(clusterId) {
  const clusters = await readRegistry();
  const cluster = clusters.find((candidate) => candidate.id === clusterId);

  if (!cluster) {
    throw new RegistryError('Cluster profile not found', {
      code: 'CLUSTER_NOT_FOUND',
      statusCode: 404,
      details: { clusterId },
    });
  }

  return cluster;
}

export async function upsertClusterProfile(input, clusterId = null) {
  const clusters = await readRegistry();
  const normalized = normalizeClusterProfile(input, clusterId);
  const existingIndex = clusters.findIndex((cluster) => cluster.id === normalized.id);

  if (existingIndex === -1) {
    clusters.push(normalized);
  } else {
    clusters[existingIndex] = normalized;
  }

  await writeRegistry(clusters);
  return normalized;
}

export async function deleteClusterProfile(clusterId) {
  const clusters = await readRegistry();
  const nextClusters = clusters.filter((cluster) => cluster.id !== clusterId);

  if (nextClusters.length === clusters.length) {
    throw new RegistryError('Cluster profile not found', {
      code: 'CLUSTER_NOT_FOUND',
      statusCode: 404,
      details: { clusterId },
    });
  }

  await writeRegistry(nextClusters);
  return { deleted: true, clusterId };
}

export function toPublicCluster(profile) {
  const publicCluster = {
    id: profile.id,
    displayName: profile.displayName,
    kind: profile.kind,
    provider: profile.provider,
    environment: profile.environment,
    nodeName: profile.nodeName,
    nodeIp: profile.nodeIp,
    sshProfileRef: profile.sshProfileRef,
    ssh: profile.ssh ? {
      host: profile.ssh.host,
      user: profile.ssh.user,
      port: profile.ssh.port,
    } : null,
    kubernetes: profile.kubernetes,
    capabilities: profile.capabilities,
    owner: profile.owner || null,
  };

  if (profile.agent) {
    publicCluster.agent = toPublicAgentState(profile.agent);
  }

  return publicCluster;
}

export function toRuntimeCluster(profile) {
  if (profile.kubernetes.accessMode === 'agent') {
    return {
      ...profile,
      commands: {
        kubectl: null,
        nodeStatus: profile.capabilities.nodeStatus ? 'agent' : null,
        veleroLocation: null,
        backups: profile.capabilities.backupHistory ? 'agent' : null,
        backupCreate: null,
        backupStatus: null,
        restorePreview: null,
        restoreExecute: profile.capabilities.restoreExecute ? 'agent' : null,
        restoreStatus: profile.capabilities.restoreStatus ? 'agent' : null,
        workloads: profile.capabilities.workloads ? 'agent' : null,
        metrics: profile.capabilities.metrics ? 'agent' : null,
        backupFreshness: profile.capabilities.backupFreshness ? 'agent' : null,
        restoreReadiness: profile.capabilities.restoreReadiness ? 'agent' : null,
        topology: profile.capabilities.topology ? 'agent' : null,
        minioService: null,
      },
    };
  }

  const commandPrefix = profile.kubernetes.accessMode === 'k3s'
    ? 'sudo -S -p "sudo password:" k3s kubectl'
    : 'kubectl';

  return {
    ...profile,
    ssh: {
      host: profile.ssh.host || sshDefaults.host,
      user: profile.ssh.user || sshDefaults.user,
      port: profile.ssh.port,
    },
    commands: {
      kubectl: commandPrefix,
      nodeStatus: profile.capabilities.nodeStatus
        ? `${commandPrefix} get node ${profile.nodeName} -o json`
        : null,
      veleroLocation: profile.capabilities.velero
        ? `${commandPrefix} get backupstoragelocation default -n velero -o json`
        : null,
      backups: profile.capabilities.backupHistory
        ? `${commandPrefix} get backups.velero.io -n velero -o json`
        : null,
      backupCreate: profile.capabilities.backupCreate
        ? commandPrefix
        : null,
      backupStatus: profile.capabilities.backupStatus
        ? commandPrefix
        : null,
      restorePreview: profile.capabilities.restorePreview
        ? commandPrefix
        : null,
      restoreExecute: profile.capabilities.restoreExecute
        ? commandPrefix
        : null,
      restoreStatus: profile.capabilities.restoreStatus
        ? commandPrefix
        : null,
      workloads: profile.capabilities.workloads
        ? `${commandPrefix} get pods -A -o json`
        : null,
      metrics: profile.capabilities.metrics
        ? commandPrefix
        : null,
      backupFreshness: profile.capabilities.backupFreshness
        ? commandPrefix
        : null,
      restoreReadiness: profile.capabilities.restoreReadiness
        ? commandPrefix
        : null,
      topology: profile.capabilities.topology
        ? commandPrefix
        : null,
      minioService: profile.capabilities.minio
        ? `${commandPrefix} get svc minio -n minio -o json`
        : null,
    },
  };
}

export function assertCapability(cluster, capability) {
  if (!cluster.commands?.[capability]) {
    throw new RegistryError('Cluster profile does not support this capability', {
      code: 'CAPABILITY_NOT_SUPPORTED',
      statusCode: 400,
      details: {
        clusterId: cluster.id,
        capability,
      },
    });
  }
}

async function readRegistry() {
  try {
    const text = await readFile(registryPath, 'utf8');
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      throw new RegistryError('Cluster registry must be a JSON array', {
        code: 'INVALID_REGISTRY',
        statusCode: 500,
      });
    }

    return parsed.map((cluster) => normalizeClusterProfile(cluster));
  } catch (error) {
    if (error instanceof RegistryError) {
      throw error;
    }

    throw new RegistryError('Failed to read cluster registry', {
      code: 'REGISTRY_READ_FAILED',
      statusCode: 500,
      details: { reason: error.message },
    });
  }
}

async function writeRegistry(clusters) {
  const normalized = clusters.map((cluster) => normalizeClusterProfile(cluster));
  const tempPath = `${registryPath}.tmp`;

  await mkdir(dirname(registryPath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await rename(tempPath, registryPath);
}

function normalizeClusterProfile(input, idOverride = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RegistryError('Cluster profile must be an object', {
      code: 'INVALID_CLUSTER_PROFILE',
    });
  }

  assertNoSecretFields(input);

  const id = normalizeString(idOverride || input.id, 'id');
  const kind = normalizeString(input.kind, 'kind');
  const displayName = normalizeString(input.displayName || input.name || id, 'displayName');
  const nodeName = normalizeString(input.nodeName, 'nodeName');
  const nodeIp = normalizeString(input.nodeIp, 'nodeIp');
  const accessMode = normalizeString(input.kubernetes?.accessMode || defaultAccessMode(kind), 'kubernetes.accessMode');

  if (!idPattern.test(id)) {
    throw new RegistryError('Cluster id must use lowercase letters, numbers, and hyphens', {
      code: 'INVALID_CLUSTER_ID',
      details: { id },
    });
  }

  if (!supportedKinds.has(kind)) {
    throw new RegistryError('Unsupported cluster kind', {
      code: 'UNSUPPORTED_CLUSTER_KIND',
      details: { kind, supportedKinds: [...supportedKinds] },
    });
  }

  if (!supportedAccessModes.has(accessMode)) {
    throw new RegistryError('Unsupported Kubernetes access mode', {
      code: 'UNSUPPORTED_ACCESS_MODE',
      details: { accessMode, supportedAccessModes: [...supportedAccessModes] },
    });
  }

  if (
    (kind === 'cloud-k8s' && accessMode !== 'kubectl')
    || (kind === 'edge-k3s' && accessMode !== 'k3s')
    || (kind === 'user-k8s' && accessMode !== 'agent')
  ) {
    throw new RegistryError('Cluster kind and Kubernetes access mode do not match a supported lab profile', {
      code: 'INVALID_KIND_ACCESS_MODE',
      details: { kind, accessMode },
    });
  }

  if (!nodeNamePattern.test(nodeName)) {
    throw new RegistryError('Invalid Kubernetes node name', {
      code: 'INVALID_NODE_NAME',
      details: { nodeName },
    });
  }

  const normalized = {
    id,
    displayName,
    kind,
    provider: normalizeOptionalString(input.provider, kind === 'user-k8s' ? 'User Cluster' : 'Lab'),
    environment: normalizeOptionalString(input.environment, defaultEnvironment(kind)),
    nodeName,
    nodeIp,
    sshProfileRef: accessMode === 'agent' ? null : normalizeOptionalString(input.sshProfileRef, 'local-vbox-nat'),
    ssh: accessMode === 'agent' ? null : normalizeSshProfile(input.ssh || {}),
    kubernetes: {
      accessMode,
      sudo: Boolean(input.kubernetes?.sudo || accessMode === 'k3s'),
    },
    capabilities: normalizeCapabilities(kind, input.capabilities || {}),
    owner: normalizeOptionalString(input.owner, null),
  };

  if (kind === 'user-k8s') {
    normalized.agent = normalizeAgentState(input.agent || {});
  }

  return normalized;
}

function normalizeCapabilities(kind, capabilities) {
  let defaults;

  if (kind === 'cloud-k8s') {
    defaults = {
        nodeStatus: true,
        velero: true,
        backupHistory: true,
        backupCreate: true,
        backupStatus: true,
        restorePreview: true,
        restoreExecute: false,
        restoreStatus: false,
        workloads: true,
        metrics: true,
        backupFreshness: true,
        restoreReadiness: false,
        topology: true,
        minio: false,
      };
  } else if (kind === 'edge-k3s') {
    defaults = {
        nodeStatus: true,
        velero: false,
        backupHistory: false,
        backupCreate: false,
        backupStatus: false,
        restorePreview: false,
        restoreExecute: true,
        restoreStatus: true,
        workloads: true,
        metrics: true,
        backupFreshness: false,
        restoreReadiness: true,
        topology: true,
        minio: true,
      };
  } else {
    defaults = {
      nodeStatus: true,
      velero: true,
      backupHistory: true,
      backupCreate: false,
      backupStatus: false,
      restorePreview: false,
      restoreExecute: true,
      restoreStatus: true,
      workloads: true,
      metrics: true,
      backupFreshness: true,
      restoreReadiness: true,
      topology: true,
      minio: false,
    };
  }

  return {
    nodeStatus: Boolean(capabilities.nodeStatus ?? defaults.nodeStatus),
    velero: Boolean(capabilities.velero ?? defaults.velero),
    backupHistory: Boolean(capabilities.backupHistory ?? defaults.backupHistory),
    backupCreate: Boolean(capabilities.backupCreate ?? defaults.backupCreate),
    backupStatus: Boolean(capabilities.backupStatus ?? defaults.backupStatus),
    restorePreview: Boolean(capabilities.restorePreview ?? defaults.restorePreview),
    restoreExecute: Boolean(capabilities.restoreExecute ?? defaults.restoreExecute),
    restoreStatus: Boolean(capabilities.restoreStatus ?? defaults.restoreStatus),
    workloads: Boolean(capabilities.workloads ?? defaults.workloads),
    metrics: Boolean(capabilities.metrics ?? defaults.metrics),
    backupFreshness: Boolean(capabilities.backupFreshness ?? defaults.backupFreshness),
    restoreReadiness: Boolean(capabilities.restoreReadiness ?? defaults.restoreReadiness),
    topology: Boolean(capabilities.topology ?? defaults.topology),
    minio: Boolean(capabilities.minio ?? defaults.minio),
  };
}

function normalizeSshProfile(ssh) {
  return {
    host: normalizeOptionalString(ssh.host, sshDefaults.host),
    user: normalizeOptionalString(ssh.user, sshDefaults.user),
    port: normalizePort(ssh.port),
  };
}

function defaultAccessMode(kind) {
  if (kind === 'user-k8s') {
    return 'agent';
  }

  return kind === 'edge-k3s' ? 'k3s' : 'kubectl';
}

function defaultEnvironment(kind) {
  if (kind === 'cloud-k8s') {
    return 'Cloud K8s primary';
  }

  if (kind === 'edge-k3s') {
    return 'Edge K3s recovery';
  }

  return 'External user cluster';
}

function normalizeString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RegistryError(`Missing required field: ${fieldName}`, {
      code: 'MISSING_REQUIRED_FIELD',
      details: { fieldName },
    });
  }

  return value.trim();
}

function normalizeOptionalString(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return String(value).trim();
  }

  return value.trim();
}

function normalizePort(value) {
  const port = Number.parseInt(value ?? 22, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RegistryError('SSH port must be between 1 and 65535', {
      code: 'INVALID_SSH_PORT',
      details: { port: value },
    });
  }

  return port;
}

function normalizeAgentState(agent) {
  return {
    agentAuthHash: normalizeOptionalString(agent.agentAuthHash, ''),
    registeredAt: normalizeOptionalTimestamp(agent.registeredAt),
    lastHeartbeatAt: normalizeOptionalTimestamp(agent.lastHeartbeatAt),
    lastCollectedAt: normalizeOptionalTimestamp(agent.lastCollectedAt),
    state: normalizeAgentReportedState(agent.state || {}),
    restoreStatuses: normalizeAgentRestoreStatuses(agent.restoreStatuses || {}),
  };
}

function normalizeAgentReportedState(state) {
  const nodes = Array.isArray(state.nodes) ? state.nodes.slice(0, 100).map((node) => ({
    name: normalizeOptionalString(node?.name, 'unknown'),
    status: normalizeOptionalString(node?.status, 'Unknown'),
    version: normalizeOptionalString(node?.version, ''),
  })) : [];
  const workloads = state.workloads && typeof state.workloads === 'object' && !Array.isArray(state.workloads)
    ? state.workloads
    : {};
  const namespaceValues = Array.isArray(workloads.namespaces) ? workloads.namespaces : [];
  const backups = Array.isArray(state.backups) ? state.backups.slice(0, 100).map((backup) => ({
    name: normalizeOptionalString(backup?.name, ''),
    phase: normalizeOptionalString(backup?.phase, 'Unknown'),
    timestamp: normalizeOptionalTimestamp(backup?.timestamp),
  })).filter((backup) => backup.name) : [];

  return {
    nodes,
    workloads: {
      runningPods: normalizeNonNegativeInteger(workloads.runningPods),
      pendingPods: normalizeNonNegativeInteger(workloads.pendingPods),
      failedPods: normalizeNonNegativeInteger(workloads.failedPods),
      namespaces: namespaceValues.map((namespace) => normalizeOptionalString(namespace, '')).filter(Boolean).slice(0, 100),
    },
    backups,
  };
}

function normalizeAgentRestoreStatuses(statuses) {
  if (!statuses || typeof statuses !== 'object' || Array.isArray(statuses)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(statuses).slice(0, 100).map(([operationId, status]) => [
      normalizeOptionalString(operationId, ''),
      {
        operationId: normalizeOptionalString(status?.operationId, operationId),
        restoreName: normalizeOptionalString(status?.restoreName, ''),
        backupName: normalizeOptionalString(status?.backupName, ''),
        phase: normalizeOptionalString(status?.phase, 'Unknown'),
        message: normalizeOptionalString(status?.message, ''),
        updatedAt: normalizeOptionalTimestamp(status?.updatedAt),
      },
    ]).filter(([operationId]) => operationId),
  );
}

function normalizeOptionalTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeNonNegativeInteger(value) {
  const number = Number.parseInt(value ?? 0, 10);

  return Number.isInteger(number) && number > 0 ? number : 0;
}

function toPublicAgentState(agent) {
  return {
    registeredAt: agent.registeredAt,
    lastHeartbeatAt: agent.lastHeartbeatAt,
    lastCollectedAt: agent.lastCollectedAt,
    state: agent.state,
    restoreStatuses: agent.restoreStatuses,
    connected: agent.lastHeartbeatAt ? Date.now() - new Date(agent.lastHeartbeatAt).getTime() <= 90000 : false,
  };
}

function assertNoSecretFields(value, path = '') {
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;

    if (/password|secret|token|credential/i.test(key)) {
      throw new RegistryError('Secret fields are not allowed in cluster registry profiles', {
        code: 'SECRET_FIELD_NOT_ALLOWED',
        details: { field: childPath },
      });
    }

    assertNoSecretFields(childValue, childPath);
  }
}
