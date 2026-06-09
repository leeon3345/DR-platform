import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const platformUrl = normalizePlatformUrl(process.env.PLATFORM_URL);
const clusterId = normalizeName(process.env.CLUSTER_ID || 'user-k8s', 'CLUSTER_ID');
const pollInterval = normalizeInterval(process.env.POLL_INTERVAL || '30000');
let clusterToken = process.env.CLUSTER_TOKEN?.trim() || '';

await start();

async function start() {
  log(`starting dr-agent for ${clusterId}`);
  await registerAgent();
  await runCycle();
  setInterval(runCycle, pollInterval);
}

async function runCycle() {
  try {
    const heartbeat = await collectHeartbeat();
    await postJson('/api/agent/heartbeat', {
      ...heartbeat,
      clusterId,
      token: clusterToken,
    });
    log(`heartbeat sent with ${heartbeat.nodes.length} nodes`);
  } catch (error) {
    logError('heartbeat failed', error);
  }

  try {
    const payload = await getJson(`/api/agent/commands?token=${encodeURIComponent(clusterToken)}&clusterId=${encodeURIComponent(clusterId)}`);
    const commands = Array.isArray(payload?.commands) ? payload.commands : [];

    for (const command of commands) {
      await handleCommand(command);
    }
  } catch (error) {
    logError('command poll failed', error);
  }
}

async function registerAgent() {
  try {
    const heartbeat = await collectHeartbeat();
    const primaryNode = heartbeat.nodes[0];
    const body = {
      clusterId,
      displayName: process.env.CLUSTER_DISPLAY_NAME || clusterId,
      nodeName: primaryNode?.name || clusterId,
      nodeIp: 'agent-reported',
    };

    if (clusterToken) {
      body.token = clusterToken;
    }

    const response = await postJson('/api/agent/register', body);
    clusterToken = response?.token || clusterToken;

    if (!clusterToken) {
      throw new Error('platform did not return an agent token');
    }

    log('agent registered');
  } catch (error) {
    logError('registration failed', error);
    throw error;
  }
}

async function collectHeartbeat() {
  const collectedAt = new Date().toISOString();
  const [nodes, workloads, backups] = await Promise.all([
    collectNodes(),
    collectWorkloads(),
    collectBackups(),
  ]);

  return {
    collectedAt,
    nodes,
    workloads,
    backups,
  };
}

async function collectNodes() {
  try {
    const nodeList = await runJson('kubectl', ['get', 'nodes', '-o', 'json']);

    return (nodeList.items || []).map((node) => {
      const ready = (node.status?.conditions || []).find((condition) => condition.type === 'Ready');

      return {
        name: normalizeName(node.metadata?.name || 'unknown-node', 'node.name'),
        status: ready?.status === 'True' ? 'Ready' : 'NotReady',
        version: String(node.status?.nodeInfo?.kubeletVersion || ''),
      };
    });
  } catch (error) {
    logError('kubectl node collection failed', error);
    return [];
  }
}

async function collectWorkloads() {
  try {
    const podList = await runJson('kubectl', ['get', 'pods', '-A', '-o', 'json']);
    const pods = podList.items || [];
    const namespaces = [...new Set(pods.map((pod) => pod.metadata?.namespace || 'default'))].sort();

    return {
      runningPods: pods.filter((pod) => pod.status?.phase === 'Running').length,
      pendingPods: pods.filter((pod) => pod.status?.phase === 'Pending').length,
      failedPods: pods.filter((pod) => pod.status?.phase === 'Failed').length,
      namespaces,
    };
  } catch (error) {
    logError('kubectl workload collection failed', error);
    return {
      runningPods: 0,
      pendingPods: 0,
      failedPods: 0,
      namespaces: [],
    };
  }
}

async function collectBackups() {
  try {
    const backupList = await runJson('velero', ['backup', 'get', '-o', 'json']);

    return (backupList.items || []).map((backup) => ({
      name: normalizeName(backup.metadata?.name || 'unknown-backup', 'backup.name'),
      phase: String(backup.status?.phase || 'Unknown'),
      timestamp: backup.status?.completionTimestamp || backup.status?.startTimestamp || backup.metadata?.creationTimestamp || new Date().toISOString(),
    })).sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp))).slice(0, 50);
  } catch (error) {
    logError('velero backup collection failed', error);
    return [];
  }
}

async function handleCommand(command) {
  if (command?.type !== 'velero-restore') {
    log(`ignoring unsupported command type ${command?.type || 'unknown'}`);
    return;
  }

  const operationId = normalizeOperationId(command.operationId || command.id || command.restoreName);
  const restoreName = normalizeName(command.restoreName, 'restoreName');
  const backupName = normalizeName(command.backupName, 'backupName');

  try {
    await reportStatus({ operationId, restoreName, backupName, phase: 'Running', message: 'Restore command accepted by dr-agent' });
    const result = await executeRestoreCommand({
      restoreName,
      backupName,
      namespaces: command.namespaces,
      labels: command.labels,
    });
    const phase = result.status?.phase || 'Submitted';

    await reportStatus({ operationId, restoreName, backupName, phase, message: 'Velero restore command submitted' });
  } catch (error) {
    logError(`restore ${restoreName} failed`, error);
    await reportStatus({ operationId, restoreName, backupName, phase: 'Failed', message: sanitizeMessage(error.message) });
  }
}

async function executeRestoreCommand({ restoreName, backupName, namespaces, labels }) {
  const args = ['restore', 'create', restoreName, '--from-backup', backupName];
  const safeNamespaces = normalizeNamespaces(namespaces);
  const selector = normalizeSelector(labels);

  if (safeNamespaces.length) {
    args.push('--include-namespaces', safeNamespaces.join(','));
  }

  if (selector) {
    args.push('--selector', selector);
  }

  args.push('-o', 'json');

  return runJson('velero', args);
}

async function reportStatus(body) {
  await postJson('/api/agent/status', {
    ...body,
    clusterId,
    token: clusterToken,
  });
}

async function runJson(command, args) {
  const { stdout } = await execFileAsync(command, args, {
    timeout: 20000,
    maxBuffer: 1024 * 1024 * 5,
  });

  return JSON.parse(stdout);
}

async function getJson(path) {
  const response = await fetch(`${platformUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });

  return readResponse(response);
}

async function postJson(path, body) {
  const response = await fetch(`${platformUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return readResponse(response);
}

async function readResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }

  return payload;
}

function normalizePlatformUrl(value) {
  if (!value || !/^https?:\/\//.test(value)) {
    throw new Error('PLATFORM_URL must be an http(s) URL');
  }

  return value.replace(/\/$/, '');
}

function normalizeInterval(value) {
  const interval = Number.parseInt(value, 10);

  if (!Number.isInteger(interval) || interval < 5000) {
    return 30000;
  }

  return interval;
}

function normalizeName(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  const text = value.trim();

  if (text.length > 63 || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(text)) {
    throw new Error(`${fieldName} must be a Kubernetes-safe lowercase name`);
  }

  return text;
}

function normalizeOperationId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('operationId is required');
  }

  return value.trim().replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120);
}

function normalizeNamespaces(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((namespace) => normalizeName(namespace, 'namespace')))];
}

function normalizeSelector(labels) {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    return '';
  }

  return Object.entries(labels)
    .map(([key, value]) => `${normalizeLabelKey(key)}=${normalizeLabelValue(value)}`)
    .join(',');
}

function normalizeLabelKey(value) {
  const key = String(value || '').trim();

  if (key.length > 253 || !/^([A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?\/)?[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/.test(key)) {
    throw new Error('invalid label selector key');
  }

  return key;
}

function normalizeLabelValue(value) {
  const labelValue = String(value ?? '').trim();

  if (labelValue.length > 63 || !/^([A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?)?$/.test(labelValue)) {
    throw new Error('invalid label selector value');
  }

  return labelValue;
}

function sanitizeMessage(value) {
  return String(value || 'command failed').replace(/\s+/g, ' ').slice(0, 300);
}

function log(message) {
  console.log(`[dr-agent] ${message}`);
}

function logError(message, error) {
  console.error(`[dr-agent] ${message}: ${sanitizeMessage(error.message)}`);
}
