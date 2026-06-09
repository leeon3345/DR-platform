import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
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
const recoveryPolicyRegistryUrl = new URL('./registry/recovery-policy.json', import.meta.url);
const recoveryPolicyRegistryDirectoryUrl = new URL('./registry/', import.meta.url);
const alertEventHistoryLimit = 20;
const alertEventHistory = [];
const agentCommandQueues = new Map();
let alertEventSequence = 0;
const tierWeights = {
  critical: 100,
  high: 70,
  normal: 40,
  low: 10,
};

const routes = new Map([
  ['GET /api/clusters', listClusters],
  ['POST /api/clusters', createCluster],
  ['GET /api/clusters/cloud-primary/status', () => getClusterStatus('cloud-primary')],
  ['GET /api/clusters/edge-recovery/status', () => getClusterStatus('edge-recovery')],
  ['GET /api/clusters/cloud-primary/velero/location', getVeleroLocation],
  ['GET /api/clusters/cloud-primary/backups', getBackupHistory],
  ['GET /api/storage/minio/status', getMinioStatus],
  ['POST /api/events/alert', receiveAlertEvent],
  ['GET /api/events/latest', getLatestAlertEvent],
  ['GET /api/events/history', getAlertEventHistory],
  ['POST /api/agent/register', registerAgent],
  ['POST /api/agent/heartbeat', receiveAgentHeartbeat],
  ['GET /api/agent/commands', getAgentCommands],
  ['POST /api/agent/status', receiveAgentStatus],
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

  if (cluster.kind === 'user-k8s') {
    return normalizeAgentNodeStatus(cluster);
  }

  assertCapability(cluster, 'nodeStatus');
  const result = await runSshCommand(cluster, cluster.commands.nodeStatus);
  const node = parseJsonCommand(result.stdout, `${cluster.id}:nodeStatus`);

  return normalizeNodeStatus(cluster, node);
}

async function getClusterMetrics({ params }) {
  const cluster = await getCluster(params.clusterId);
  assertCapability(cluster, 'metrics');

  const [node, workloads, backupFreshness, restoreReadiness] = await Promise.all([
    getClusterStatus(cluster.id),
    getWorkloadHealth({ params: { clusterId: cluster.id } }),
    cluster.commands.backupFreshness
      ? getBackupFreshness({ params: { clusterId: cluster.id } })
      : Promise.resolve(null),
    cluster.commands.restoreReadiness
      ? getRestoreReadiness({ params: { clusterId: cluster.id } })
      : Promise.resolve(null),
  ]);

  return {
    clusterId: cluster.id,
    displayName: cluster.displayName,
    clusterKind: cluster.kind,
    collectedAt: new Date().toISOString(),
    node: {
      ready: node.healthStatus === 'Ready',
      nodeName: node.nodeName,
      nodeIp: node.nodeIp,
      kubernetesVersion: node.kubernetesVersion,
      healthStatus: node.healthStatus,
    },
    workloads: workloads.summary,
    backupFreshness: backupFreshness?.backupFreshness ?? null,
    restoreReadiness: restoreReadiness?.restoreReadiness ?? null,
  };
}

async function getWorkloadHealth({ params }) {
  const cluster = await getCluster(params.clusterId);

  if (cluster.kind === 'user-k8s') {
    return normalizeAgentWorkloads(cluster);
  }

  assertCapability(cluster, 'workloads');
  const result = await runSshCommand(cluster, cluster.commands.workloads);
  const podList = parseJsonCommand(result.stdout, `${cluster.id}:workloads`);
  const workloads = normalizeWorkloads(cluster, podList);

  return {
    clusterId: cluster.id,
    collectedAt: new Date().toISOString(),
    ...workloads,
  };
}

async function getBackupFreshness({ params }) {
  const cluster = await getCluster(params.clusterId);
  assertCapability(cluster, 'backupFreshness');
  assertCapability(cluster, 'backups');

  const history = await getBackupHistory({ params: { clusterId: cluster.id } });
  const latest = history.backups[0] || null;
  const ageMinutes = latest?.createdTimestamp ? minutesSince(latest.createdTimestamp) : null;
  const freshnessStatus = latest?.status === 'Completed' && ageMinutes !== null && ageMinutes <= 60
    ? 'Fresh'
    : latest
      ? 'Stale'
      : 'Unavailable';

  return {
    clusterId: cluster.id,
    collectedAt: new Date().toISOString(),
    backupFreshness: {
      latestBackupName: latest?.backupName || null,
      latestBackupPhase: latest?.status || null,
      latestBackupTimestamp: latest?.createdTimestamp || null,
      latestCompletionTimestamp: latest?.completionTimestamp || null,
      ageMinutes,
      freshnessStatus,
      backupCount: history.backups.length,
      completedBackups: history.backups.filter((backup) => backup.status === 'Completed').length,
      warningBackups: history.backups.filter((backup) => (backup.warnings || 0) > 0).length,
      failedBackups: history.backups.filter((backup) => backup.status && backup.status !== 'Completed').length,
    },
  };
}

async function getRestoreReadiness({ params }) {
  const cluster = await getCluster(params.clusterId);
  assertCapability(cluster, 'restoreReadiness');

  const [node, workloads] = await Promise.all([
    getClusterStatus(cluster.id),
    getWorkloadHealth({ params: { clusterId: cluster.id } }),
  ]);
  const minioStatus = cluster.commands.minioService ? await getMinioStatus() : null;
  const nodeReady = node.healthStatus === 'Ready';
  const workloadReady = workloads.summary.failedPods === 0;
  const storageReachable = !minioStatus || Boolean(minioStatus.apiNodePort);
  const readinessScore = Math.round(
    ((nodeReady ? 45 : 0) + (workloadReady ? 35 : 0) + (storageReachable ? 20 : 0)),
  );

  return {
    clusterId: cluster.id,
    collectedAt: new Date().toISOString(),
    restoreReadiness: {
      status: readinessScore >= 80 ? 'Ready' : readinessScore >= 50 ? 'Degraded' : 'Blocked',
      score: readinessScore,
      nodeReady,
      workloadReady,
      storageReachable,
      checks: [
        {
          name: 'node-ready',
          passed: nodeReady,
          message: `${node.nodeName} is ${node.healthStatus}`,
        },
        {
          name: 'workloads-stable',
          passed: workloadReady,
          message: `${workloads.summary.failedPods} failed pods`,
        },
        {
          name: 'backup-storage-reachable',
          passed: storageReachable,
          message: storageReachable ? 'Backup storage endpoint is reachable from registry data' : 'Backup storage endpoint is unavailable',
        },
      ],
    },
  };
}

async function getClusterTopology({ params }) {
  const cluster = await getCluster(params.clusterId);
  assertCapability(cluster, 'topology');
  const profiles = await listClusterProfiles();
  const publicClusters = profiles.map(toPublicCluster);
  const sourceClusters = publicClusters.filter((profile) => profile.kind === 'cloud-k8s');
  const targetClusters = publicClusters.filter((profile) => profile.kind === 'edge-k3s');

  return {
    clusterId: cluster.id,
    collectedAt: new Date().toISOString(),
    nodes: publicClusters.map((profile) => ({
      id: profile.id,
      type: profile.kind,
      label: profile.displayName,
      nodeName: profile.nodeName,
      nodeIp: profile.nodeIp,
      selected: profile.id === cluster.id,
      capabilities: Object.entries(profile.capabilities)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name),
    })),
    edges: sourceClusters.flatMap((source) =>
      targetClusters.map((target) => ({
        source: source.id,
        target: target.id,
        relationship: source.id === cluster.id ? 'backup-source' : 'restore-target',
      })),
    ),
  };
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

  if (cluster.kind === 'user-k8s') {
    return {
      backups: (cluster.agent?.state?.backups || []).map(normalizeAgentBackup),
      lastCheckedTimestamp: cluster.agent?.lastHeartbeatAt || new Date().toISOString(),
    };
  }

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

  if (targetCluster.kind === 'user-k8s') {
    const command = enqueueAgentRestoreCommand(targetCluster, input);

    return {
      statusCode: 202,
      payload: {
        restore: {
          restoreName: input.restoreName,
          backupName: input.backupName,
          status: 'PendingAgent',
          errors: 0,
          warnings: 0,
          createdTimestamp: command.createdAt,
          startTimestamp: null,
          completionTimestamp: null,
          includedNamespaces: input.namespaces,
        },
        command,
        sourceBackup: normalizeBackup(sourceBackup),
        sourceClusterId: sourceCluster.id,
        targetClusterId: targetCluster.id,
        acceptedTimestamp: command.createdAt,
      },
    };
  }

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

  if (cluster.kind === 'user-k8s') {
    const status = Object.values(cluster.agent?.restoreStatuses || {})
      .find((candidate) => candidate.restoreName === restoreName || candidate.operationId === restoreName);

    if (!status) {
      throw new RegistryError('Agent restore status not found', {
        code: 'RESTORE_NOT_FOUND',
        statusCode: 404,
        details: { clusterId: cluster.id, restoreName },
      });
    }

    return {
      restore: {
        restoreName: status.restoreName || restoreName,
        backupName: status.backupName || null,
        status: status.phase,
        errors: 0,
        warnings: 0,
        createdTimestamp: null,
        startTimestamp: null,
        completionTimestamp: status.phase === 'Completed' || status.phase === 'Failed' ? status.updatedAt : null,
        includedNamespaces: null,
      },
      clusterId: cluster.id,
      operationId: status.operationId,
      message: status.message,
      lastCheckedTimestamp: new Date().toISOString(),
    };
  }

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

async function getRecoveryPolicy({ params }) {
  const cluster = await getCluster(params.clusterId);
  assertRecoveryRecommendationSupported(cluster);
  const registry = await readRecoveryPolicyRegistry();
  const clusterState = getRecoveryPolicyClusterState(registry, cluster.id);

  return {
    clusterId: cluster.id,
    policies: clusterState.policies,
    updatedAt: clusterState.updatedAt || null,
  };
}

async function updateRecoveryPolicy({ request, params }) {
  const cluster = await getCluster(params.clusterId);
  assertRecoveryRecommendationSupported(cluster);
  const input = await readJsonBody(request);
  assertNoSecretRequestFields(input);
  const policies = normalizeRecoveryPolicies(input);
  const registry = await readRecoveryPolicyRegistry();
  const existingState = getRecoveryPolicyClusterState(registry, cluster.id);
  const updatedAt = new Date().toISOString();

  registry.clusters[cluster.id] = {
    ...existingState,
    policies,
    updatedAt,
  };

  await writeRecoveryPolicyRegistry(registry);

  return {
    clusterId: cluster.id,
    policies,
    updatedAt,
  };
}

async function getRecoveryRecommendations({ params }) {
  const cluster = await getCluster(params.clusterId);
  assertRecoveryRecommendationSupported(cluster);
  assertCapability(cluster, 'workloads');
  assertCapability(cluster, 'backups');

  const [registry, workloads, history] = await Promise.all([
    readRecoveryPolicyRegistry(),
    getWorkloadHealth({ params: { clusterId: cluster.id } }),
    getBackupHistory({ params: { clusterId: cluster.id } }),
  ]);
  const clusterState = getRecoveryPolicyClusterState(registry, cluster.id);
  const scored = scoreRecoveryRecommendations({
    cluster,
    policies: clusterState.policies,
    approvals: clusterState.approvals,
    workloads,
    backups: history.backups,
  });
  const recommendations = await Promise.all(scored.map(async (recommendation) => ({
      ...recommendation,
      explanation: await generateRecommendationExplanation(recommendation),
    })));

  return {
    clusterId: cluster.id,
    generatedAt: new Date().toISOString(),
    recommendations,
  };
}

async function approveRecoveryRecommendation({ params }) {
  const cluster = await getCluster(params.clusterId);
  assertRecoveryRecommendationSupported(cluster);
  const namespace = normalizeResourceName(params.workloadId, 'workloadId');
  const registry = await readRecoveryPolicyRegistry();
  const existingState = getRecoveryPolicyClusterState(registry, cluster.id);
  const updatedAt = new Date().toISOString();

  registry.clusters[cluster.id] = {
    ...existingState,
    approvals: {
      ...existingState.approvals,
      [namespace]: true,
    },
    updatedAt,
  };

  await writeRecoveryPolicyRegistry(registry);

  return {
    clusterId: cluster.id,
    workloadId: namespace,
    approved: true,
    approvedAt: updatedAt,
  };
}

async function receiveAlertEvent({ request }) {
  const input = await readJsonBody(request);
  const events = normalizeAlertmanagerPayload(input);

  alertEventHistory.unshift(...events);
  alertEventHistory.splice(alertEventHistoryLimit);

  return {
    statusCode: 202,
    payload: {
      accepted: true,
      events,
      latest: alertEventHistory[0] || null,
    },
  };
}

async function getLatestAlertEvent() {
  return {
    event: alertEventHistory[0] || null,
  };
}

async function getAlertEventHistory() {
  return {
    events: alertEventHistory.slice(0, alertEventHistoryLimit),
  };
}

async function registerAgent({ request }) {
  const input = await readJsonBody(request);
  const clusterId = normalizeResourceName(input.clusterId, 'clusterId');
  const token = input.token ? normalizeAgentToken(input.token) : issueAgentToken();
  const now = new Date().toISOString();
  const existing = await getOptionalClusterProfile(clusterId);

  if (existing && existing.kind !== 'user-k8s') {
    throw new RegistryError('Cluster id is already registered for a non-agent cluster', {
      code: 'CLUSTER_ID_CONFLICT',
      statusCode: 409,
      details: { clusterId },
    });
  }

  if (existing?.agent?.agentAuthHash && input.token) {
    assertAgentTokenMatches(existing, token);
  }

  const profile = await upsertClusterProfile({
    ...(existing || {}),
    id: clusterId,
    displayName: normalizeShortText(input.displayName || existing?.displayName || clusterId, 'displayName'),
    kind: 'user-k8s',
    provider: normalizeShortText(input.provider || existing?.provider || 'User Cluster', 'provider'),
    environment: normalizeShortText(input.environment || existing?.environment || 'External user cluster', 'environment'),
    nodeName: normalizeAgentNodeName(input.nodeName || existing?.nodeName || clusterId),
    nodeIp: normalizeShortText(input.nodeIp || existing?.nodeIp || 'agent-reported', 'nodeIp'),
    kubernetes: { accessMode: 'agent' },
    capabilities: {
      nodeStatus: true,
      velero: true,
      backupHistory: true,
      restoreExecute: true,
      restoreStatus: true,
      workloads: true,
      metrics: true,
      backupFreshness: true,
      restoreReadiness: true,
      topology: true,
    },
    agent: {
      ...(existing?.agent || {}),
      agentAuthHash: hashAgentToken(token),
      registeredAt: existing?.agent?.registeredAt || now,
    },
  }, clusterId);

  return {
    statusCode: existing ? 200 : 201,
    payload: {
      cluster: toPublicCluster(profile),
      token,
      registeredAt: profile.agent.registeredAt,
    },
  };
}

async function receiveAgentHeartbeat({ request }) {
  const input = await readJsonBody(request);
  const cluster = await requireAgentCluster(input);
  const collectedAt = normalizeIsoTimestamp(input.collectedAt || new Date().toISOString(), 'collectedAt');
  const heartbeat = normalizeAgentHeartbeat(input);
  const primaryNode = heartbeat.nodes[0];
  const now = new Date().toISOString();
  const profile = await upsertClusterProfile({
    ...cluster,
    nodeName: primaryNode?.name || cluster.nodeName,
    nodeIp: cluster.nodeIp || 'agent-reported',
    agent: {
      ...(cluster.agent || {}),
      lastHeartbeatAt: now,
      lastCollectedAt: collectedAt,
      state: {
        nodes: heartbeat.nodes,
        workloads: heartbeat.workloads,
        backups: heartbeat.backups,
      },
    },
  }, cluster.id);

  return {
    statusCode: 202,
    payload: {
      accepted: true,
      cluster: toPublicCluster(profile),
      lastHeartbeatAt: profile.agent.lastHeartbeatAt,
    },
  };
}

async function getAgentCommands({ url }) {
  const cluster = await requireAgentCluster({
    clusterId: url.searchParams.get('clusterId'),
    token: url.searchParams.get('token'),
  });
  const queue = agentCommandQueues.get(cluster.id) || [];
  const commands = queue.splice(0, queue.length).map((command) => ({
    ...command,
    dispatchedAt: new Date().toISOString(),
  }));

  agentCommandQueues.set(cluster.id, queue);

  return {
    commands,
  };
}

async function receiveAgentStatus({ request }) {
  const input = await readJsonBody(request);
  const cluster = await requireAgentCluster(input);
  const operationId = normalizeAgentOperationId(input.operationId || input.restoreName, 'operationId');
  const restoreName = normalizeResourceName(input.restoreName || operationId, 'restoreName');
  const phase = normalizeAgentPhase(input.phase || input.status || 'Unknown');
  const updatedAt = new Date().toISOString();
  const profile = await upsertClusterProfile({
    ...cluster,
    agent: {
      ...(cluster.agent || {}),
      restoreStatuses: {
        ...(cluster.agent?.restoreStatuses || {}),
        [operationId]: {
          operationId,
          restoreName,
          backupName: input.backupName ? normalizeResourceName(input.backupName, 'backupName') : null,
          phase,
          message: normalizeShortText(input.message || '', 'message', { required: false, maxLength: 500 }),
          updatedAt,
        },
      },
    },
  }, cluster.id);

  return {
    statusCode: 202,
    payload: {
      accepted: true,
      clusterId: cluster.id,
      restoreStatus: profile.agent.restoreStatuses[operationId],
    },
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

function normalizeWorkloads(cluster, podList) {
  const pods = (podList.items || []).map((pod) => {
    const containers = [
      ...(pod.status?.containerStatuses || []),
      ...(pod.status?.initContainerStatuses || []),
    ];
    const readyContainers = containers.filter((container) => container.ready).length;
    const restartCount = containers.reduce((total, container) => total + (container.restartCount || 0), 0);

    return {
      namespace: pod.metadata?.namespace || 'default',
      name: pod.metadata?.name || null,
      phase: pod.status?.phase || 'Unknown',
      readyContainers,
      totalContainers: containers.length,
      restartCount,
      nodeName: pod.spec?.nodeName || null,
    };
  });
  const namespaces = pods.reduce((accumulator, pod) => {
    accumulator[pod.namespace] = (accumulator[pod.namespace] || 0) + 1;
    return accumulator;
  }, {});
  const namespaceHealth = Object.entries(
    pods.reduce((accumulator, pod) => {
      accumulator[pod.namespace] ??= {
        namespace: pod.namespace,
        totalPods: 0,
        runningPods: 0,
        pendingPods: 0,
        failedPods: 0,
        succeededPods: 0,
        unknownPods: 0,
      };

      const health = accumulator[pod.namespace];
      health.totalPods += 1;

      if (pod.phase === 'Running') {
        health.runningPods += 1;
      } else if (pod.phase === 'Pending') {
        health.pendingPods += 1;
      } else if (pod.phase === 'Failed') {
        health.failedPods += 1;
      } else if (pod.phase === 'Succeeded') {
        health.succeededPods += 1;
      } else {
        health.unknownPods += 1;
      }

      return accumulator;
    }, {}),
  ).map(([, health]) => health);

  return {
    summary: {
      totalPods: pods.length,
      runningPods: pods.filter((pod) => pod.phase === 'Running').length,
      pendingPods: pods.filter((pod) => pod.phase === 'Pending').length,
      failedPods: pods.filter((pod) => pod.phase === 'Failed').length,
      succeededPods: pods.filter((pod) => pod.phase === 'Succeeded').length,
      unknownPods: pods.filter((pod) => !['Running', 'Pending', 'Failed', 'Succeeded'].includes(pod.phase)).length,
      restartCount: pods.reduce((total, pod) => total + pod.restartCount, 0),
      namespaces: Object.entries(namespaces)
        .map(([namespace, podCount]) => ({ namespace, podCount }))
        .sort((left, right) => right.podCount - left.podCount),
      namespaceHealth: namespaceHealth.sort((left, right) => right.totalPods - left.totalPods),
    },
    pods: pods.slice(0, 50),
    nodeName: cluster.nodeName,
  };
}

function normalizeAgentNodeStatus(cluster) {
  const nodes = cluster.agent?.state?.nodes || [];
  const readyNodes = nodes.filter((node) => node.status === 'Ready');
  const primaryNode = nodes[0] || {};

  return {
    clusterId: cluster.id,
    displayName: cluster.displayName,
    clusterKind: cluster.kind,
    nodeName: primaryNode.name || cluster.nodeName,
    nodeIp: cluster.nodeIp,
    kubernetesVersion: primaryNode.version || null,
    healthStatus: nodes.length > 0 && readyNodes.length === nodes.length ? 'Ready' : 'NotReady',
    readyNodes: readyNodes.length,
    totalNodes: nodes.length,
    lastCheckedTimestamp: cluster.agent?.lastHeartbeatAt || new Date().toISOString(),
  };
}

function normalizeAgentWorkloads(cluster) {
  const workloads = cluster.agent?.state?.workloads || {};
  const runningPods = workloads.runningPods || 0;
  const pendingPods = workloads.pendingPods || 0;
  const failedPods = workloads.failedPods || 0;
  const namespaces = (workloads.namespaces || []).map((namespace) => ({
    namespace,
    podCount: null,
  }));
  const totalPods = runningPods + pendingPods + failedPods;

  return {
    clusterId: cluster.id,
    collectedAt: cluster.agent?.lastCollectedAt || cluster.agent?.lastHeartbeatAt || new Date().toISOString(),
    summary: {
      totalPods,
      runningPods,
      pendingPods,
      failedPods,
      succeededPods: 0,
      unknownPods: 0,
      restartCount: 0,
      namespaces,
      namespaceHealth: namespaces.map(({ namespace }) => ({
        namespace,
        totalPods: 0,
        runningPods: 0,
        pendingPods: 0,
        failedPods: 0,
        succeededPods: 0,
        unknownPods: 0,
      })),
    },
    pods: [],
    nodeName: cluster.nodeName,
  };
}

function normalizeAgentBackup(backup) {
  return {
    backupName: backup.name,
    status: backup.phase,
    errors: 0,
    warnings: 0,
    createdTimestamp: backup.timestamp,
    completionTimestamp: backup.phase === 'Completed' ? backup.timestamp : null,
    expirationTimestamp: null,
    storageLocation: null,
    includedNamespaces: null,
    ttl: null,
  };
}

function enqueueAgentRestoreCommand(cluster, input) {
  const operationId = `restore-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const command = {
    id: operationId,
    operationId,
    type: 'velero-restore',
    allowlist: 'velero restore create',
    restoreName: input.restoreName,
    backupName: input.backupName,
    namespaces: input.namespaces,
    labels: input.labels,
    createdAt: new Date().toISOString(),
  };
  const queue = agentCommandQueues.get(cluster.id) || [];

  queue.push(command);
  agentCommandQueues.set(cluster.id, queue);

  return command;
}

async function getOptionalClusterProfile(clusterId) {
  try {
    return await getClusterProfile(clusterId);
  } catch (error) {
    if (error instanceof RegistryError && error.code === 'CLUSTER_NOT_FOUND') {
      return null;
    }

    throw error;
  }
}

async function requireAgentCluster(input) {
  const clusterId = normalizeResourceName(input.clusterId, 'clusterId');
  const token = normalizeAgentToken(input.token);
  const profile = await getClusterProfile(clusterId);

  if (profile.kind !== 'user-k8s') {
    throw new RegistryError('Cluster profile is not registered for agent access', {
      code: 'CLUSTER_NOT_FOUND',
      statusCode: 404,
      details: { clusterId },
    });
  }

  assertAgentTokenMatches(profile, token);

  return profile;
}

function assertAgentTokenMatches(profile, token) {
  const expectedHash = profile.agent?.agentAuthHash;

  if (!expectedHash || !verifyAgentToken(token, expectedHash)) {
    throw new RegistryError('Agent token is invalid for this cluster', {
      code: 'INVALID_TOKEN',
      statusCode: 401,
      details: { clusterId: profile.id },
    });
  }
}

function issueAgentToken() {
  return `usr_${crypto.randomBytes(24).toString('base64url')}`;
}

function hashAgentToken(token) {
  return `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function verifyAgentToken(token, expectedHash) {
  const actual = Buffer.from(hashAgentToken(token));
  const expected = Buffer.from(String(expectedHash));

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizeAgentHeartbeat(input) {
  const nodes = Array.isArray(input.nodes) ? input.nodes.map((node, index) => ({
    name: normalizeAgentNodeName(node?.name || `node-${index + 1}`),
    status: normalizeAgentNodePhase(node?.status || 'Unknown'),
    version: normalizeShortText(node?.version || '', 'version', { required: false, maxLength: 80 }),
  })).slice(0, 100) : [];
  const workloads = input.workloads && typeof input.workloads === 'object' && !Array.isArray(input.workloads)
    ? input.workloads
    : {};
  const backups = Array.isArray(input.backups) ? input.backups.map((backup) => ({
    name: normalizeResourceName(backup?.name, 'backup.name'),
    phase: normalizeAgentPhase(backup?.phase || 'Unknown'),
    timestamp: normalizeIsoTimestamp(backup?.timestamp || new Date().toISOString(), 'backup.timestamp'),
  })).slice(0, 100) : [];

  return {
    nodes,
    workloads: {
      runningPods: normalizeAgentCount(workloads.runningPods, 'workloads.runningPods'),
      pendingPods: normalizeAgentCount(workloads.pendingPods, 'workloads.pendingPods'),
      failedPods: normalizeAgentCount(workloads.failedPods, 'workloads.failedPods'),
      namespaces: Array.isArray(workloads.namespaces)
        ? workloads.namespaces.map((namespace) => normalizeResourceName(namespace, 'workloads.namespaces')).slice(0, 100)
        : [],
    },
    backups,
  };
}

function normalizeAgentToken(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RegistryError('Missing required field: token', {
      code: 'MISSING_REQUIRED_FIELD',
      details: { fieldName: 'token' },
    });
  }

  const token = value.trim();

  if (token.length < 8 || token.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(token)) {
    throw new RegistryError('Agent token must be an opaque single-line value', {
      code: 'INVALID_TOKEN',
      details: { fieldName: 'token' },
    });
  }

  return token;
}

function normalizeAgentNodeName(value) {
  return normalizeShortText(value, 'nodeName', { maxLength: 120 }).replace(/[^A-Za-z0-9.-]/g, '-');
}

function normalizeAgentNodePhase(value) {
  const phase = normalizeShortText(value, 'node.status', { maxLength: 40 });

  return phase === 'Ready' ? 'Ready' : phase;
}

function normalizeAgentPhase(value) {
  return normalizeShortText(value, 'phase', { maxLength: 80 });
}

function normalizeAgentOperationId(value, fieldName) {
  return normalizeShortText(value, fieldName, { maxLength: 120 }).replace(/[^A-Za-z0-9._:-]/g, '-');
}

function normalizeAgentCount(value, fieldName) {
  const number = Number.parseInt(value ?? 0, 10);

  if (!Number.isInteger(number) || number < 0 || number > 100000) {
    throw new RegistryError(`${fieldName} must be a non-negative integer`, {
      code: 'INVALID_AGENT_PAYLOAD',
      details: { fieldName },
    });
  }

  return number;
}

function normalizeIsoTimestamp(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RegistryError(`${fieldName} must be an ISO timestamp`, {
      code: 'INVALID_AGENT_PAYLOAD',
      details: { fieldName },
    });
  }

  return date.toISOString();
}

function normalizeShortText(value, fieldName, { required = true, maxLength = 160 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (!required) {
      return '';
    }

    throw new RegistryError(`Missing required field: ${fieldName}`, {
      code: 'MISSING_REQUIRED_FIELD',
      details: { fieldName },
    });
  }

  const text = String(value).trim();

  if (!text || text.length > maxLength || /[\r\n]/.test(text) || /password|secret|credential/i.test(text)) {
    throw new RegistryError(`${fieldName} must be a short non-secret single-line value`, {
      code: 'INVALID_AGENT_PAYLOAD',
      details: { fieldName },
    });
  }

  return text;
}

function assertRecoveryRecommendationSupported(cluster) {
  if (cluster.kind !== 'cloud-k8s') {
    throw new RegistryError('Recovery recommendations are only supported for cloud-k8s source clusters', {
      code: 'CAPABILITY_NOT_SUPPORTED',
      statusCode: 400,
      details: {
        clusterId: cluster.id,
        clusterKind: cluster.kind,
      },
    });
  }
}

async function readRecoveryPolicyRegistry() {
  try {
    const text = await fs.readFile(recoveryPolicyRegistryUrl, 'utf8');
    const registry = JSON.parse(text);

    return {
      clusters: registry && typeof registry === 'object' && !Array.isArray(registry) ? registry.clusters || {} : {},
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { clusters: {} };
    }

    if (error instanceof SyntaxError) {
      throw new RegistryError('Recovery policy registry contains invalid JSON', {
        code: 'INVALID_RECOVERY_POLICY_REGISTRY',
      });
    }

    throw error;
  }
}

async function writeRecoveryPolicyRegistry(registry) {
  await fs.mkdir(recoveryPolicyRegistryDirectoryUrl, { recursive: true });
  await fs.writeFile(recoveryPolicyRegistryUrl, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

function getRecoveryPolicyClusterState(registry, clusterId) {
  registry.clusters ??= {};
  const state = registry.clusters[clusterId] || {};

  return {
    policies: Array.isArray(state.policies) ? state.policies : [],
    approvals: state.approvals && typeof state.approvals === 'object' && !Array.isArray(state.approvals)
      ? state.approvals
      : {},
    updatedAt: state.updatedAt || null,
  };
}

function normalizeRecoveryPolicies(input) {
  const entries = Array.isArray(input) ? input : input?.policies;

  if (!Array.isArray(entries)) {
    throw new RegistryError('recovery policy request must include a policies array', {
      code: 'INVALID_RECOVERY_POLICY',
      details: { fieldName: 'policies' },
    });
  }

  const seenNamespaces = new Set();

  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new RegistryError('each recovery policy entry must be an object', {
        code: 'INVALID_RECOVERY_POLICY',
      });
    }

    const namespace = normalizeResourceName(entry.namespace, 'namespace');
    const tier = normalizeRecoveryTier(entry.tier);

    if (seenNamespaces.has(namespace)) {
      throw new RegistryError('recovery policy namespaces must be unique per cluster', {
        code: 'DUPLICATE_RECOVERY_POLICY',
        details: { namespace },
      });
    }

    seenNamespaces.add(namespace);

    return {
      namespace,
      tier,
      rto: normalizePolicyTarget(entry.rto, 'rto'),
      rpo: normalizePolicyTarget(entry.rpo, 'rpo'),
      labels: normalizeLabels(entry.labels),
    };
  });
}

function normalizeRecoveryTier(value) {
  const tier = String(value || 'normal').trim().toLowerCase();

  if (!Object.hasOwn(tierWeights, tier)) {
    throw new RegistryError('tier must be one of critical, high, normal, or low', {
      code: 'INVALID_RECOVERY_TIER',
      details: { tier },
    });
  }

  return tier;
}

function normalizePolicyTarget(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length > 32 || /password|secret|token|credential/i.test(value)) {
    throw new RegistryError(`${fieldName} must be a short non-secret string`, {
      code: 'INVALID_RECOVERY_POLICY_TARGET',
      details: { fieldName },
    });
  }

  return value.trim();
}

function scoreRecoveryRecommendations({ cluster, policies, approvals, workloads, backups }) {
  const policyByNamespace = Object.fromEntries(policies.map((policy) => [policy.namespace, policy]));
  const healthByNamespace = Object.fromEntries((workloads.summary.namespaceHealth || []).map((health) => [health.namespace, health]));
  const namespaceNames = [...new Set([
    ...Object.keys(policyByNamespace),
    ...(workloads.summary.namespaces || []).map((item) => item.namespace),
  ])].sort();

  return namespaceNames
    .map((namespace) => {
      const policy = policyByNamespace[namespace] || {
        namespace,
        tier: 'normal',
        rto: null,
        rpo: null,
        labels: {},
      };
      const health = healthByNamespace[namespace] || emptyNamespaceHealth(namespace);
      const backup = findLatestCompletedBackupForNamespace(backups, namespace);
      const backupAgeMinutes = backup?.completionTimestamp || backup?.createdTimestamp
        ? minutesSince(backup.completionTimestamp || backup.createdTimestamp)
        : null;
      const tierWeight = tierWeights[policy.tier];
      const backupFreshness = scoreBackupFreshness(backupAgeMinutes);
      const workloadHealth = scoreWorkloadHealth(health);
      const score = Math.round((tierWeight * 0.4) + (backupFreshness * 0.4) + (workloadHealth * 0.2));

      return {
        rank: 0,
        workloadId: namespace,
        namespace,
        clusterId: cluster.id,
        tier: policy.tier,
        rto: policy.rto,
        rpo: policy.rpo,
        score,
        scoreBreakdown: {
          tierWeight,
          backupFreshness,
          workloadHealth,
        },
        backupAgeMinutes,
        latestBackupName: backup?.backupName || null,
        podSummary: summarizeNamespaceHealth(health),
        approved: Boolean(approvals[namespace]),
      };
    })
    .sort((left, right) =>
      right.score - left.score
      || right.scoreBreakdown.tierWeight - left.scoreBreakdown.tierWeight
      || left.namespace.localeCompare(right.namespace),
    )
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
}

function emptyNamespaceHealth(namespace) {
  return {
    namespace,
    totalPods: 0,
    runningPods: 0,
    pendingPods: 0,
    failedPods: 0,
    succeededPods: 0,
    unknownPods: 0,
  };
}

function findLatestCompletedBackupForNamespace(backups, namespace) {
  return backups.find((backup) => {
    if (backup.status !== 'Completed') {
      return false;
    }

    if (!Array.isArray(backup.includedNamespaces) || backup.includedNamespaces.length === 0) {
      return true;
    }

    return backup.includedNamespaces.includes('*') || backup.includedNamespaces.includes(namespace);
  }) || null;
}

function scoreBackupFreshness(ageMinutes) {
  if (ageMinutes === null || ageMinutes === undefined) {
    return 20;
  }

  if (ageMinutes <= 60) {
    return 100;
  }

  if (ageMinutes <= 360) {
    return 80;
  }

  if (ageMinutes <= 1440) {
    return 50;
  }

  return 20;
}

function scoreWorkloadHealth(health) {
  if (health.failedPods > 0) {
    return 0;
  }

  if (health.pendingPods > 0) {
    return 50;
  }

  if (health.totalPods > 0 && health.runningPods === health.totalPods) {
    return 100;
  }

  return 50;
}

function summarizeNamespaceHealth(health) {
  if (health.totalPods === 0) {
    return 'No pods observed for this namespace';
  }

  const parts = [
    `${health.runningPods}/${health.totalPods} Running`,
  ];

  if (health.pendingPods > 0) {
    parts.push(`${health.pendingPods} Pending`);
  }

  if (health.failedPods > 0) {
    parts.push(`${health.failedPods} Failed`);
  }

  if (health.unknownPods > 0) {
    parts.push(`${health.unknownPods} Unknown`);
  }

  return parts.join(', ');
}

async function generateRecommendationExplanation(recommendation) {
  const fallback = buildFallbackRecommendationExplanation(recommendation);
  const apiKey = process.env.LLM_API_KEY?.trim();

  if (!apiKey) {
    return fallback;
  }

  try {
    const response = await fetch(process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You write concise disaster recovery advice for Kubernetes operators.',
          },
          {
            role: 'user',
            content: buildRecommendationPrompt(recommendation),
          },
        ],
        temperature: 0.2,
        max_tokens: 180,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;

    return sanitizeExplanation(text) || fallback;
  } catch {
    return fallback;
  }
}

function buildRecommendationPrompt(recommendation) {
  return [
    'You are a disaster recovery advisor for a Kubernetes platform.',
    'Given the following workload recovery score, write a 2-3 sentence explanation',
    'for an operator that justifies the ranking and highlights any risks.',
    '',
    `Workload: ${recommendation.namespace}`,
    `Tier: ${recommendation.tier}`,
    `Score: ${recommendation.score} / 100`,
    `Tier weight: ${recommendation.scoreBreakdown.tierWeight}`,
    `Backup age: ${recommendation.backupAgeMinutes ?? 'missing'} minutes (freshness score: ${recommendation.scoreBreakdown.backupFreshness})`,
    `Pod health: ${recommendation.podSummary} (health score: ${recommendation.scoreBreakdown.workloadHealth})`,
    `RTO target: ${recommendation.rto || 'not set'}`,
    `RPO target: ${recommendation.rpo || 'not set'}`,
    '',
    'Respond in plain text only. Do not use markdown or bullet points.',
  ].join('\n');
}

function buildFallbackRecommendationExplanation(recommendation) {
  const backupAge = recommendation.backupAgeMinutes === null || recommendation.backupAgeMinutes === undefined
    ? 'no completed backup was found'
    : `the latest completed backup is ${recommendation.backupAgeMinutes} minutes old`;
  const approval = recommendation.approved ? 'The operator has already approved this recommendation.' : 'Operator approval is still required before restore execution.';

  return `${recommendation.namespace} is ranked ${recommendation.rank} with a score of ${recommendation.score} because its tier is ${recommendation.tier}, ${backupAge}, and pod health is ${recommendation.podSummary}. ${approval}`;
}

function sanitizeExplanation(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

function minutesSince(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
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

function normalizeAlertmanagerPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.alerts) || input.alerts.length === 0) {
    throw new RegistryError('Alertmanager webhook payload must include a non-empty alerts array', {
      code: 'INVALID_ALERT_PAYLOAD',
      statusCode: 400,
      details: { fieldName: 'alerts' },
    });
  }

  const receivedAt = new Date().toISOString();

  return input.alerts.map((alert, index) => normalizeAlertmanagerAlert(alert, {
    commonLabels: input.commonLabels,
    payloadStatus: input.status,
    receivedAt,
    index,
  }));
}

function normalizeAlertmanagerAlert(alert, { commonLabels, payloadStatus, receivedAt, index }) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) {
    throw new RegistryError('Each Alertmanager alert must be an object', {
      code: 'INVALID_ALERT_PAYLOAD',
      statusCode: 400,
      details: { fieldName: `alerts.${index}` },
    });
  }

  const labels = alert.labels && typeof alert.labels === 'object' && !Array.isArray(alert.labels)
    ? alert.labels
    : {};
  const fallbackLabels = commonLabels && typeof commonLabels === 'object' && !Array.isArray(commonLabels)
    ? commonLabels
    : {};
  const status = normalizeAlertStatus(alert.status || payloadStatus);
  const alertname = normalizeAlertField(labels.alertname ?? fallbackLabels.alertname, 'alertname', { required: true });
  const namespace = normalizeAlertField(labels.namespace ?? fallbackLabels.namespace, 'namespace', { required: false });
  const severity = normalizeAlertSeverity(labels.severity ?? fallbackLabels.severity, status);
  const startsAt = normalizeAlertTimestamp(alert.startsAt, 'startsAt');

  alertEventSequence += 1;

  return {
    id: buildAlertEventId(receivedAt, alertEventSequence),
    receivedAt,
    source: 'alertmanager',
    status,
    alertname,
    namespace,
    severity,
    clusterId: 'user-k8s',
    startsAt,
  };
}

function normalizeAlertStatus(value) {
  const status = String(value || 'firing').trim().toLowerCase();

  if (!['firing', 'resolved'].includes(status)) {
    throw new RegistryError('Alertmanager alert status must be firing or resolved', {
      code: 'INVALID_ALERT_STATUS',
      statusCode: 400,
      details: { status },
    });
  }

  return status;
}

function normalizeAlertSeverity(value, status) {
  if (status === 'resolved') {
    return 'resolved';
  }

  const severity = normalizeAlertField(value || 'warning', 'severity', { required: false }) || 'warning';

  return severity.toLowerCase();
}

function normalizeAlertField(value, fieldName, { required }) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new RegistryError(`Missing required alert label: ${fieldName}`, {
        code: 'MISSING_ALERT_LABEL',
        statusCode: 400,
        details: { fieldName },
      });
    }

    return null;
  }

  const text = String(value).trim();

  if (!text || text.length > 120 || /[\r\n]/.test(text)) {
    throw new RegistryError(`Alert label ${fieldName} must be a short single-line value`, {
      code: 'INVALID_ALERT_LABEL',
      statusCode: 400,
      details: { fieldName },
    });
  }

  return text;
}

function normalizeAlertTimestamp(value, fieldName) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RegistryError(`Alert timestamp ${fieldName} must be an ISO timestamp`, {
      code: 'INVALID_ALERT_TIMESTAMP',
      statusCode: 400,
      details: { fieldName },
    });
  }

  return date.toISOString();
}

function buildAlertEventId(receivedAt, sequence) {
  const compactTimestamp = receivedAt.replace(/\D/g, '').slice(0, 14);
  const compactSequence = String(sequence).padStart(3, '0');

  return `evt-${compactTimestamp}-${compactSequence}`;
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

  const policyMatch = pathname.match(/^\/api\/clusters\/([^/]+)\/recovery-policy$/);

  if (policyMatch) {
    const [, clusterId] = policyMatch;

    if (method === 'GET') {
      return {
        handler: getRecoveryPolicy,
        params: { clusterId },
      };
    }

    if (method === 'POST') {
      return {
        handler: updateRecoveryPolicy,
        params: { clusterId },
      };
    }

    return null;
  }

  const recommendationMatch = pathname.match(/^\/api\/clusters\/([^/]+)\/recommendations(?:\/([^/]+)\/approve)?$/);

  if (recommendationMatch) {
    const [, clusterId, workloadId] = recommendationMatch;

    if (!workloadId && method === 'GET') {
      return {
        handler: getRecoveryRecommendations,
        params: { clusterId },
      };
    }

    if (workloadId && method === 'POST') {
      return {
        handler: approveRecoveryRecommendation,
        params: { clusterId, workloadId },
      };
    }

    return null;
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

  const metricsMatch = pathname.match(/^\/api\/clusters\/([^/]+)\/(status|metrics|workloads|backup-freshness|restore-readiness|topology)$/);

  if (metricsMatch) {
    const [, clusterId, action] = metricsMatch;
    const handlers = {
      status: ({ params }) => getClusterStatus(params.clusterId),
      metrics: getClusterMetrics,
      workloads: getWorkloadHealth,
      'backup-freshness': getBackupFreshness,
      'restore-readiness': getRestoreReadiness,
      topology: getClusterTopology,
    };

    if (method === 'GET') {
      return {
        handler: handlers[action],
        params: { clusterId },
      };
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
