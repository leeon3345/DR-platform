import http from 'node:http';
import { URL } from 'node:url';
import { minio } from './lab-config.mjs';
import { ApiCommandError, parseJsonCommand, runSshCommand } from './command-runner.mjs';
import {
  RegistryError,
  assertCapability,
  deleteClusterProfile,
  getClusterProfile,
  listClusterProfiles,
  toPublicCluster,
  toRuntimeCluster,
  upsertClusterProfile,
} from './cluster-registry.mjs';

const host = process.env.API_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.API_PORT || '3001', 10);
const veleroNamespace = 'velero';
const resourceNamePattern = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const ttlPattern = /^[0-9]+h[0-9]+m[0-9]+s$/;
const labelKeyPattern = /^([A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?\/)?[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/;
const labelValuePattern = /^([A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?)?$/;

const routes = new Map([
  ['GET /api/clusters', listClusters],
  ['POST /api/clusters', createCluster],
  ['GET /api/clusters/cloud-primary/status', () => getClusterStatus('cloud-primary')],
  ['GET /api/clusters/edge-recovery/status', () => getClusterStatus('edge-recovery')],
  ['GET /api/clusters/cloud-primary/velero/location', getVeleroLocation],
  ['GET /api/clusters/cloud-primary/backups', getBackupHistory],
  ['GET /api/storage/minio/status', getMinioStatus],
]);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null);
    return;
  }

  const routeMatch = getRoute(request.method, url.pathname);

  if (!routeMatch) {
    sendJson(response, 404, {
      error: {
        code: 'NOT_FOUND',
        message: 'API route not found',
      },
    });
    return;
  }

  try {
    const result = await routeMatch.handler({
      request,
      url,
      params: routeMatch.params,
    });
    sendJson(response, result?.statusCode || 200, result?.payload ?? result);
  } catch (error) {
    sendJson(response, getErrorStatus(error), toErrorPayload(error));
  }
});

server.listen(port, host, () => {
  console.log(`DR Platform API listening on http://${host}:${port}`);
});

server.on('error', (error) => {
  console.error(`DR Platform API failed to start: ${error.message}`);
  process.exitCode = 1;
});

async function listClusters() {
  const profiles = await listClusterProfiles();

  return {
    clusters: profiles.map(toPublicCluster),
  };
}

async function getClusterDetails({ params }) {
  const profile = await getClusterProfile(params.clusterId);

  return {
    cluster: toPublicCluster(profile),
  };
}

async function createCluster({ request }) {
  const profile = await upsertClusterProfile(await readJsonBody(request));

  return {
    statusCode: 201,
    payload: {
      cluster: toPublicCluster(profile),
    },
  };
}

async function updateCluster({ request, params }) {
  const profile = await upsertClusterProfile(await readJsonBody(request), params.clusterId);

  return {
    cluster: toPublicCluster(profile),
  };
}

async function removeCluster({ params }) {
  return deleteClusterProfile(params.clusterId);
}

async function validateCluster({ params }) {
  const cluster = await getCluster(params.clusterId);

  try {
    assertCapability(cluster, 'nodeStatus');
    const result = await runSshCommand(cluster, cluster.commands.nodeStatus);
    const node = parseJsonCommand(result.stdout, `${cluster.id}:validate`);
    const status = normalizeNodeStatus(cluster, node);

    return {
      clusterId: cluster.id,
      valid: status.healthStatus === 'Ready',
      checkedAt: new Date().toISOString(),
      checks: [
        {
          name: 'registry-profile',
          status: 'passed',
          message: 'Cluster profile is structurally valid',
        },
        {
          name: 'node-status',
          status: status.healthStatus === 'Ready' ? 'passed' : 'failed',
          message: `${status.nodeName} is ${status.healthStatus}`,
          details: {
            nodeName: status.nodeName,
            nodeIp: status.nodeIp,
            kubernetesVersion: status.kubernetesVersion,
          },
        },
      ],
    };
  } catch (error) {
    if (!(error instanceof ApiCommandError) && !(error instanceof RegistryError)) {
      throw error;
    }

    return {
      clusterId: cluster.id,
      valid: false,
      checkedAt: new Date().toISOString(),
      checks: [
        {
          name: 'registry-profile',
          status: 'passed',
          message: 'Cluster profile is structurally valid',
        },
        {
          name: 'node-status',
          status: 'failed',
          message: 'Cluster validation failed without exposing secrets',
          error: toSafeError(error),
        },
      ],
    };
  }
}

async function getClusterStatus(clusterId) {
  const cluster = await getCluster(clusterId);
  assertCapability(cluster, 'nodeStatus');
  const result = await runSshCommand(cluster, cluster.commands.nodeStatus);
  const node = parseJsonCommand(result.stdout, `${cluster.id}:nodeStatus`);

  return normalizeNodeStatus(cluster, node);
}

async function getVeleroLocation() {
  const cluster = await getCluster('cloud-primary');
  assertCapability(cluster, 'veleroLocation');
  const result = await runSshCommand(cluster, cluster.commands.veleroLocation);
  const location = parseJsonCommand(result.stdout, 'cloud-primary:veleroLocation');

  return {
    locationName: location.metadata?.name || 'default',
    provider: location.spec?.provider || null,
    bucket: location.spec?.objectStorage?.bucket || null,
    s3Url: location.spec?.config?.s3Url || null,
    phase: location.status?.phase || null,
    accessMode: location.spec?.accessMode || 'ReadWrite',
    lastValidationTimestamp: location.status?.lastValidationTime || null,
    lastCheckedTimestamp: new Date().toISOString(),
  };
}

async function getBackupHistory({ params } = {}) {
  const cluster = await getCluster(params?.clusterId || 'cloud-primary');
  assertCapability(cluster, 'backups');
  const result = await runSshCommand(cluster, cluster.commands.backups);
  const backupList = parseJsonCommand(result.stdout, `${cluster.id}:backups`);

  return {
    backups: (backupList.items || [])
      .map(normalizeBackup)
      .sort((left, right) => String(right.createdTimestamp || '').localeCompare(String(left.createdTimestamp || ''))),
    lastCheckedTimestamp: new Date().toISOString(),
  };
}

async function createBackup({ request, params }) {
  const cluster = await getCluster(params.clusterId);
  assertCapability(cluster, 'backupCreate');

  const input = normalizeBackupRequest(await readJsonBody(request));
  const manifest = buildBackupManifest(input);
  const result = await runSshCommand(
    cluster,
    buildCreateManifestCommand(cluster.commands.backupCreate, manifest),
  );
  const backup = parseJsonCommand(result.stdout, `${cluster.id}:backupCreate`);

  return {
    statusCode: 202,
    payload: {
      backup: normalizeBackup(backup),
      clusterId: cluster.id,
      acceptedTimestamp: new Date().toISOString(),
    },
  };
}

async function getBackupStatus({ params }) {
  const cluster = await getCluster(params.clusterId);
  const backupName = normalizeResourceName(params.backupName, 'backupName');
  assertCapability(cluster, 'backupStatus');

  const result = await runSshCommand(
    cluster,
    `${cluster.commands.backupStatus} get backups.velero.io ${shellQuote(backupName)} -n ${veleroNamespace} -o json`,
  );
  const backup = parseJsonCommand(result.stdout, `${cluster.id}:backupStatus`);

  return {
    backup: normalizeBackup(backup),
    clusterId: cluster.id,
    lastCheckedTimestamp: new Date().toISOString(),
  };
}

async function previewRestore({ request, params }) {
  const sourceCluster = await getCluster(params.clusterId);
  assertCapability(sourceCluster, 'restorePreview');

  const input = normalizeRestoreRequest(await readJsonBody(request), { preview: true });
  const targetCluster = await getCluster(input.targetClusterId);
  assertCapability(sourceCluster, 'backupStatus');
  assertCapability(targetCluster, 'restoreExecute');

  const sourceBackup = await fetchBackup(sourceCluster, input.backupName);
  const manifest = buildRestoreManifest(input);

  return {
    preview: {
      restoreName: input.restoreName,
      backupName: input.backupName,
      sourceClusterId: sourceCluster.id,
      targetClusterId: targetCluster.id,
      namespaces: input.namespaces,
      labels: input.labels,
      dryRun: true,
      manifest,
      sourceBackup: normalizeBackup(sourceBackup),
      previewTimestamp: new Date().toISOString(),
    },
  };
}

async function createRestore({ request, params }) {
  const sourceCluster = await getCluster(params.clusterId);
  assertCapability(sourceCluster, 'restorePreview');

  const input = normalizeRestoreRequest(await readJsonBody(request), { preview: false });
  const targetCluster = await getCluster(input.targetClusterId);
  assertCapability(sourceCluster, 'backupStatus');
  assertCapability(targetCluster, 'restoreExecute');

  const sourceBackup = await fetchBackup(sourceCluster, input.backupName);
  const manifest = buildRestoreManifest(input);
  const result = await runSshCommand(
    targetCluster,
    buildCreateManifestCommand(targetCluster.commands.restoreExecute, manifest),
  );
  const restore = parseJsonCommand(result.stdout, `${targetCluster.id}:restoreExecute`);

  return {
    statusCode: 202,
    payload: {
      restore: normalizeRestore(restore),
      sourceBackup: normalizeBackup(sourceBackup),
      sourceClusterId: sourceCluster.id,
      targetClusterId: targetCluster.id,
      acceptedTimestamp: new Date().toISOString(),
    },
  };
}

async function getRestoreStatus({ params }) {
  const cluster = await getCluster(params.clusterId);
  const restoreName = normalizeResourceName(params.restoreName, 'restoreName');
  assertCapability(cluster, 'restoreStatus');

  const result = await runSshCommand(
    cluster,
    `${cluster.commands.restoreStatus} get restores.velero.io ${shellQuote(restoreName)} -n ${veleroNamespace} -o json`,
  );
  const restore = parseJsonCommand(result.stdout, `${cluster.id}:restoreStatus`);

  return {
    restore: normalizeRestore(restore),
    clusterId: cluster.id,
    lastCheckedTimestamp: new Date().toISOString(),
  };
}

async function getMinioStatus() {
  const edgeCluster = await getCluster('edge-recovery');
  assertCapability(edgeCluster, 'minioService');
  const result = await runSshCommand(edgeCluster, edgeCluster.commands.minioService);
  const service = parseJsonCommand(result.stdout, 'edge-recovery:minioService');
  const ports = service.spec?.ports || [];
  const apiPort = findServicePort(ports, minio.expectedApiPort);
  const consolePort = findServicePort(ports, minio.expectedConsolePort);

  return {
    namespace: service.metadata?.namespace || minio.namespace,
    serviceName: service.metadata?.name || minio.serviceName,
    serviceType: service.spec?.type || null,
    clusterIp: service.spec?.clusterIP || null,
    apiNodePort: apiPort?.nodePort || null,
    consoleNodePort: consolePort?.nodePort || null,
    expectedApiEndpointFromK8sMaster: apiPort?.nodePort
      ? `http://${edgeCluster.nodeIp}:${apiPort.nodePort}`
      : null,
    lastCheckedTimestamp: new Date().toISOString(),
  };
}

function normalizeNodeStatus(cluster, node) {
  const readyCondition = (node.status?.conditions || []).find((condition) => condition.type === 'Ready');
  const internalIp = (node.status?.addresses || []).find((address) => address.type === 'InternalIP')?.address;

  return {
    clusterId: cluster.id,
    displayName: cluster.displayName,
    clusterKind: cluster.kind,
    nodeName: node.metadata?.name || cluster.nodeName,
    nodeIp: internalIp || cluster.nodeIp,
    kubernetesVersion: node.status?.nodeInfo?.kubeletVersion || null,
    healthStatus: readyCondition?.status === 'True' ? 'Ready' : 'NotReady',
    lastCheckedTimestamp: new Date().toISOString(),
  };
}

function findServicePort(ports, portNumber) {
  return ports.find((port) => port.port === portNumber || port.targetPort === portNumber);
}

async function fetchBackup(cluster, backupName) {
  const result = await runSshCommand(
    cluster,
    `${cluster.commands.backupStatus} get backups.velero.io ${shellQuote(backupName)} -n ${veleroNamespace} -o json`,
  );

  return parseJsonCommand(result.stdout, `${cluster.id}:backupStatus`);
}

function buildBackupManifest(input) {
  const spec = {};

  if (input.namespaces.length > 0) {
    spec.includedNamespaces = input.namespaces;
  }

  if (input.ttl) {
    spec.ttl = input.ttl;
  }

  if (Object.keys(input.labels).length > 0) {
    spec.labelSelector = {
      matchLabels: input.labels,
    };
  }

  return {
    apiVersion: 'velero.io/v1',
    kind: 'Backup',
    metadata: {
      name: input.backupName,
      namespace: veleroNamespace,
      labels: {
        'app.kubernetes.io/managed-by': 'dr-platform',
      },
    },
    spec,
  };
}

function buildRestoreManifest(input) {
  const spec = {
    backupName: input.backupName,
    includedNamespaces: input.namespaces,
  };

  if (Object.keys(input.labels).length > 0) {
    spec.labelSelector = {
      matchLabels: input.labels,
    };
  }

  return {
    apiVersion: 'velero.io/v1',
    kind: 'Restore',
    metadata: {
      name: input.restoreName,
      namespace: veleroNamespace,
      labels: {
        'app.kubernetes.io/managed-by': 'dr-platform',
      },
    },
    spec,
  };
}

function buildCreateManifestCommand(kubectlCommand, manifest) {
  const manifestJson = JSON.stringify(manifest);

  return [
    'tmpfile=$(mktemp /tmp/dr-platform-velero.XXXXXX)',
    `printf %s ${shellQuote(manifestJson)} > "$tmpfile"`,
    `${kubectlCommand} create -f "$tmpfile" -o json`,
    'status=$?',
    'rm -f "$tmpfile"',
    'exit $status',
  ].join('; ');
}

function normalizeBackupRequest(input) {
  assertNoSecretRequestFields(input);

  return {
    backupName: normalizeResourceName(input.backupName, 'backupName'),
    namespaces: normalizeNamespaces(input.namespaces, { required: false }),
    labels: normalizeLabels(input.labels),
    ttl: normalizeTtl(input.ttl),
  };
}

function normalizeRestoreRequest(input, { preview }) {
  assertNoSecretRequestFields(input);

  if (!preview && input.confirm !== true) {
    throw new RegistryError('Restore execution requires confirm: true', {
      code: 'RESTORE_CONFIRMATION_REQUIRED',
      details: { fieldName: 'confirm' },
    });
  }

  if (!preview && input.dryRun === true) {
    throw new RegistryError('Restore execution cannot be requested with dryRun: true', {
      code: 'INVALID_RESTORE_REQUEST',
      details: { fieldName: 'dryRun' },
    });
  }

  return {
    restoreName: normalizeResourceName(input.restoreName, 'restoreName'),
    backupName: normalizeResourceName(input.backupName, 'backupName'),
    targetClusterId: normalizeResourceName(input.targetClusterId, 'targetClusterId'),
    namespaces: normalizeNamespaces(input.namespaces, { required: true }),
    labels: normalizeLabels(input.labels),
  };
}

function normalizeBackup(backup) {
  return {
    backupName: backup.metadata?.name || null,
    status: backup.status?.phase || null,
    errors: backup.status?.errors ?? 0,
    warnings: backup.status?.warnings ?? 0,
    createdTimestamp: backup.status?.startTimestamp || backup.metadata?.creationTimestamp || null,
    completionTimestamp: backup.status?.completionTimestamp || null,
    expirationTimestamp: backup.status?.expiration || null,
    storageLocation: backup.spec?.storageLocation || backup.status?.storageLocation || null,
    includedNamespaces: backup.spec?.includedNamespaces || null,
    ttl: backup.spec?.ttl || null,
  };
}

function normalizeRestore(restore) {
  return {
    restoreName: restore.metadata?.name || null,
    backupName: restore.spec?.backupName || null,
    status: restore.status?.phase || null,
    errors: restore.status?.errors ?? 0,
    warnings: restore.status?.warnings ?? 0,
    createdTimestamp: restore.metadata?.creationTimestamp || null,
    startTimestamp: restore.status?.startTimestamp || null,
    completionTimestamp: restore.status?.completionTimestamp || null,
    includedNamespaces: restore.spec?.includedNamespaces || null,
  };
}

function normalizeResourceName(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RegistryError(`Missing required field: ${fieldName}`, {
      code: 'MISSING_REQUIRED_FIELD',
      details: { fieldName },
    });
  }

  const name = value.trim();

  if (name.length > 63 || !resourceNamePattern.test(name)) {
    throw new RegistryError(`${fieldName} must be a lowercase Kubernetes-safe name`, {
      code: 'INVALID_RESOURCE_NAME',
      details: { fieldName },
    });
  }

  return name;
}

function normalizeNamespaces(value, { required }) {
  if (value === undefined || value === null) {
    if (required) {
      throw new RegistryError('At least one namespace is required', {
        code: 'MISSING_REQUIRED_FIELD',
        details: { fieldName: 'namespaces' },
      });
    }

    return [];
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new RegistryError('namespaces must be a non-empty array when provided', {
      code: 'INVALID_NAMESPACES',
      details: { fieldName: 'namespaces' },
    });
  }

  return [...new Set(value.map((namespace) => normalizeResourceName(namespace, 'namespaces')))];
}

function normalizeLabels(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RegistryError('labels must be an object of Kubernetes label keys and values', {
      code: 'INVALID_LABELS',
    });
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, labelValue]) => {
      const normalizedKey = String(key).trim();
      const normalizedValue = String(labelValue ?? '').trim();

      if (normalizedKey.length > 253 || !labelKeyPattern.test(normalizedKey)) {
        throw new RegistryError('Invalid Kubernetes label key', {
          code: 'INVALID_LABELS',
          details: { key: normalizedKey },
        });
      }

      if (normalizedValue.length > 63 || !labelValuePattern.test(normalizedValue)) {
        throw new RegistryError('Invalid Kubernetes label value', {
          code: 'INVALID_LABELS',
          details: { key: normalizedKey },
        });
      }

      return [normalizedKey, normalizedValue];
    }),
  );
}

function normalizeTtl(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !ttlPattern.test(value.trim())) {
    throw new RegistryError('ttl must use Velero duration format such as 720h0m0s', {
      code: 'INVALID_TTL',
      details: { fieldName: 'ttl' },
    });
  }

  return value.trim();
}

function assertNoSecretRequestFields(value, path = '') {
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;

    if (/password|secret|token|credential/i.test(key)) {
      throw new RegistryError('Secret fields are not allowed in backup or restore request bodies', {
        code: 'SECRET_FIELD_NOT_ALLOWED',
        details: { field: childPath },
      });
    }

    assertNoSecretRequestFields(childValue, childPath);
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

async function getCluster(clusterId) {
  return toRuntimeCluster(await getClusterProfile(clusterId));
}

function getRoute(method, pathname) {
  const exact = routes.get(`${method} ${pathname}`);

  if (exact) {
    return {
      handler: exact,
      params: {},
    };
  }

  const collectionMatch = pathname.match(/^\/api\/clusters\/([^/]+)\/(backups|restores)(?:\/([^/]+))?$/);

  if (collectionMatch) {
    const [, clusterId, collection, itemName] = collectionMatch;

    if (collection === 'backups') {
      if (!itemName && method === 'GET') {
        return {
          handler: getBackupHistory,
          params: { clusterId },
        };
      }

      if (!itemName && method === 'POST') {
        return {
          handler: createBackup,
          params: { clusterId },
        };
      }

      if (itemName && method === 'GET') {
        return {
          handler: getBackupStatus,
          params: { clusterId, backupName: itemName },
        };
      }
    }

    if (collection === 'restores') {
      if (itemName === 'preview' && method === 'POST') {
        return {
          handler: previewRestore,
          params: { clusterId },
        };
      }

      if (!itemName && method === 'POST') {
        return {
          handler: createRestore,
          params: { clusterId },
        };
      }

      if (itemName && method === 'GET') {
        return {
          handler: getRestoreStatus,
          params: { clusterId, restoreName: itemName },
        };
      }
    }

    return null;
  }

  const match = pathname.match(/^\/api\/clusters\/([^/]+)(?:\/(validate))?$/);

  if (!match) {
    return null;
  }

  const [, clusterId, action] = match;

  if (action === 'validate' && method === 'POST') {
    return {
      handler: validateCluster,
      params: { clusterId },
    };
  }

  if (!action && method === 'GET') {
    return {
      handler: getClusterDetails,
      params: { clusterId },
    };
  }

  if (!action && method === 'PUT') {
    return {
      handler: updateCluster,
      params: { clusterId },
    };
  }

  if (!action && method === 'DELETE') {
    return {
      handler: removeCluster,
      params: { clusterId },
    };
  }

  return null;
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();

  if (!text) {
    throw new RegistryError('Request body must be valid JSON', {
      code: 'INVALID_JSON_BODY',
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new RegistryError('Request body must be valid JSON', {
      code: 'INVALID_JSON_BODY',
    });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  });

  if (payload === null) {
    response.end();
    return;
  }

  response.end(JSON.stringify(payload, null, 2));
}

function getErrorStatus(error) {
  if (error instanceof RegistryError) {
    return error.statusCode;
  }

  if (error instanceof ApiCommandError) {
    return 502;
  }

  return 500;
}

function toErrorPayload(error) {
  const safeError = toSafeError(error);

  return {
    error: safeError,
  };
}

function toSafeError(error) {
  if (error instanceof RegistryError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ApiCommandError) {
    return {
      code: 'COMMAND_ERROR',
      message: error.message,
      details: error.details,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}
