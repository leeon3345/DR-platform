import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sshDefaults } from './lab-config.mjs';

const defaultRegistryPath = fileURLToPath(new URL('./registry/clusters.json', import.meta.url));
const registryPath = process.env.DR_CLUSTER_REGISTRY_PATH || defaultRegistryPath;
const supportedKinds = new Set(['cloud-k8s', 'edge-k3s']);
const supportedAccessModes = new Set(['kubectl', 'k3s']);
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
  return {
    id: profile.id,
    displayName: profile.displayName,
    kind: profile.kind,
    provider: profile.provider,
    environment: profile.environment,
    nodeName: profile.nodeName,
    nodeIp: profile.nodeIp,
    sshProfileRef: profile.sshProfileRef,
    ssh: {
      host: profile.ssh.host,
      user: profile.ssh.user,
      port: profile.ssh.port,
    },
    kubernetes: profile.kubernetes,
    capabilities: profile.capabilities,
  };
}

export function toRuntimeCluster(profile) {
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

  if ((kind === 'cloud-k8s' && accessMode !== 'kubectl') || (kind === 'edge-k3s' && accessMode !== 'k3s')) {
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

  return {
    id,
    displayName,
    kind,
    provider: normalizeOptionalString(input.provider, 'Lab'),
    environment: normalizeOptionalString(input.environment, kind === 'cloud-k8s' ? 'Cloud K8s primary' : 'Edge K3s recovery'),
    nodeName,
    nodeIp,
    sshProfileRef: normalizeOptionalString(input.sshProfileRef, 'local-vbox-nat'),
    ssh: normalizeSshProfile(input.ssh || {}),
    kubernetes: {
      accessMode,
      sudo: Boolean(input.kubernetes?.sudo || accessMode === 'k3s'),
    },
    capabilities: normalizeCapabilities(kind, input.capabilities || {}),
  };
}

function normalizeCapabilities(kind, capabilities) {
  const defaults = kind === 'cloud-k8s'
    ? {
        nodeStatus: true,
        velero: true,
        backupHistory: true,
        backupCreate: true,
        backupStatus: true,
        restorePreview: true,
        restoreExecute: false,
        restoreStatus: false,
        minio: false,
      }
    : {
        nodeStatus: true,
        velero: false,
        backupHistory: false,
        backupCreate: false,
        backupStatus: false,
        restorePreview: false,
        restoreExecute: true,
        restoreStatus: true,
        minio: true,
      };

  return {
    nodeStatus: Boolean(capabilities.nodeStatus ?? defaults.nodeStatus),
    velero: Boolean(capabilities.velero ?? defaults.velero),
    backupHistory: Boolean(capabilities.backupHistory ?? defaults.backupHistory),
    backupCreate: Boolean(capabilities.backupCreate ?? defaults.backupCreate),
    backupStatus: Boolean(capabilities.backupStatus ?? defaults.backupStatus),
    restorePreview: Boolean(capabilities.restorePreview ?? defaults.restorePreview),
    restoreExecute: Boolean(capabilities.restoreExecute ?? defaults.restoreExecute),
    restoreStatus: Boolean(capabilities.restoreStatus ?? defaults.restoreStatus),
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
  return kind === 'edge-k3s' ? 'k3s' : 'kubectl';
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
