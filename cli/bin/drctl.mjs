#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';

const configDirectory = path.join(os.homedir(), '.drctl');
const configPath = path.join(configDirectory, 'config.json');
const tokenMaskLength = 8;

const program = new Command();

program
  .name('drctl')
  .description('DR Platform operator CLI')
  .version('0.1.12')
  .option('--json', 'print raw JSON output');

program
  .command('init')
  .description('register with DR Platform and store local CLI config')
  .requiredOption('--platform <url>', 'DR Platform API URL')
  .requiredOption('--name <name>', 'operator or organization name')
  .action(async (options) => {
    await runCommand(async () => {
      const platformUrl = normalizePlatformUrl(options.platform);
      const response = await apiRequest({
        platformUrl,
        method: 'POST',
        pathname: '/api/auth/register',
        body: { name: options.name },
        token: null,
      });

      await writeConfig({
        platformUrl,
        token: response.token,
      });

      if (isJsonOutput()) {
        printJson(response);
        return;
      }

      console.log('Registered with DR Platform');
      console.log(`Platform: ${platformUrl}`);
      console.log(`Token: ${maskToken(response.token)}`);
      console.log(`Config: ${configPath}`);
      if (response.dashboardUrl) {
        console.log(`Dashboard: ${response.dashboardUrl}`);
      }
    });
  });

const cluster = program
  .command('cluster')
  .description('manage registered clusters');

cluster
  .command('list')
  .description('list registered clusters for the current token')
  .action(async () => {
    await runCommand(async () => {
      const context = await loadContext();
      const response = await apiRequest({
        ...context,
        method: 'GET',
        pathname: '/api/clusters',
      });

      if (isJsonOutput()) {
        printJson(response);
        return;
      }

      const rows = (response.clusters || []).map((item) => ({
        'CLUSTER ID': item.id || '',
        KIND: item.kind || '',
        STATUS: formatClusterStatus(item),
        NODES: formatNodeCount(item),
        'LAST SEEN': formatLastSeen(item),
      }));

      if (rows.length === 0) {
        console.log('No clusters registered for this token.');
        return;
      }

      printTable(rows);
    });
  });

cluster
  .command('validate')
  .description('validate cluster reachability through the DR Platform API')
  .argument('<clusterId>', 'cluster id')
  .action(async (clusterId) => {
    await runCommand(async () => {
      const context = await loadContext();
      const response = await apiRequest({
        ...context,
        method: 'POST',
        pathname: `/api/clusters/${encodeURIComponent(clusterId)}/validate`,
      });

      if (isJsonOutput()) {
        printJson(response);
        return;
      }

      console.log(`Cluster: ${response.clusterId || clusterId}`);
      console.log(`Valid: ${response.valid ? 'yes' : 'no'}`);
      console.log(`Checked: ${response.checkedAt || '-'}`);
      printTable((response.checks || []).map((check) => ({
        CHECK: check.name || '',
        STATUS: check.status || '',
        MESSAGE: check.message || '',
      })));
    });
  });

program
  .command('policy')
  .description('manage recovery policies')
  .command('set')
  .description('define or update recovery policy for a namespace')
  .argument('<clusterId>', 'cluster id')
  .requiredOption('--namespace <namespace>', 'Kubernetes namespace')
  .requiredOption('--tier <tier>', 'critical, high, normal, or low')
  .requiredOption('--rto <duration>', 'recovery time objective, for example 1h')
  .requiredOption('--rpo <duration>', 'recovery point objective, for example 30m')
  .action(async (clusterId, options) => {
    await runCommand(async () => {
      const context = await loadContext();
      const current = await apiRequest({
        ...context,
        method: 'GET',
        pathname: `/api/clusters/${encodeURIComponent(clusterId)}/recovery-policy`,
      });
      const nextPolicy = {
        namespace: options.namespace,
        tier: options.tier,
        rto: options.rto,
        rpo: options.rpo,
        labels: {},
      };
      const policies = mergePolicy(current.policies || [], nextPolicy);
      const response = await apiRequest({
        ...context,
        method: 'POST',
        pathname: `/api/clusters/${encodeURIComponent(clusterId)}/recovery-policy`,
        body: { policies },
      });

      if (isJsonOutput()) {
        printJson(response);
        return;
      }

      console.log(`Policy updated for ${options.namespace} on ${response.clusterId || clusterId}`);
      printTable([{
        NAMESPACE: nextPolicy.namespace,
        TIER: nextPolicy.tier,
        RTO: nextPolicy.rto,
        RPO: nextPolicy.rpo,
      }]);
    });
  });

program
  .command('recommend')
  .description('fetch recovery recommendations for a cluster')
  .argument('<clusterId>', 'cluster id')
  .action(async (clusterId) => {
    await runCommand(async () => {
      const context = await loadContext();
      const response = await apiRequest({
        ...context,
        method: 'GET',
        pathname: `/api/clusters/${encodeURIComponent(clusterId)}/recommendations`,
      });

      if (isJsonOutput()) {
        printJson(response);
        return;
      }

      const recommendations = response.recommendations || [];

      if (recommendations.length === 0) {
        console.log('No recommendations returned.');
        return;
      }

      printTable(recommendations.map((item) => ({
        RANK: item.rank ?? '',
        NAMESPACE: item.namespace || '',
        SCORE: item.score ?? '',
        TIER: item.tier || '',
        'BACKUP AGE': formatBackupAge(item.backupAgeMinutes),
      })));

      const firstExplanation = recommendations.find((item) => item.explanation);
      if (firstExplanation) {
        console.log('');
        console.log(`AI Explanation (${firstExplanation.namespace}):`);
        console.log(firstExplanation.explanation);
      }
    });
  });

program.showHelpAfterError();

async function runCommand(callback) {
  try {
    await callback();
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

async function loadContext() {
  const config = await readConfig();
  const platformUrl = normalizePlatformUrl(process.env.PLATFORM_URL || config.platformUrl);
  const token = process.env.CLUSTER_TOKEN || config.token;

  if (!platformUrl) {
    throw new CliError('CONFIG_MISSING_PLATFORM', `Set PLATFORM_URL or run "drctl init --platform <url> --name <name>".`);
  }

  if (!token) {
    throw new CliError('CONFIG_MISSING_TOKEN', 'Set CLUSTER_TOKEN or run "drctl init --platform <url> --name <name>".');
  }

  return {
    platformUrl,
    token,
  };
}

async function readConfig() {
  try {
    const text = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(text);

    return {
      platformUrl: typeof parsed.platformUrl === 'string' ? parsed.platformUrl : '',
      token: typeof parsed.token === 'string' ? parsed.token : '',
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    if (error instanceof SyntaxError) {
      throw new CliError('CONFIG_INVALID_JSON', `${configPath} must contain valid JSON.`);
    }

    throw error;
  }
}

async function writeConfig(config) {
  await fs.mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await fs.writeFile(`${configPath}.tmp`, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(`${configPath}.tmp`, configPath);
}

async function apiRequest({ platformUrl, token, method, pathname, body }) {
  const url = new URL(pathname, platformUrl);
  const headers = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new CliError('API_UNREACHABLE', `Could not reach ${url.origin}: ${error.message}`);
  }

  const text = await response.text();
  const payload = text ? parseJson(text) : {};

  if (!response.ok) {
    const apiError = payload.error || {};
    throw new CliError(
      apiError.code || `HTTP_${response.status}`,
      apiError.message || `Request failed with HTTP ${response.status}`,
      apiError.details,
    );
  }

  return payload;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new CliError('API_INVALID_JSON', 'DR Platform returned a non-JSON response.');
  }
}

function normalizePlatformUrl(value) {
  if (!value) {
    return '';
  }

  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  url.search = '';
  url.hash = '';

  return url.toString().replace(/\/$/, '');
}

function mergePolicy(policies, nextPolicy) {
  const withoutCurrent = policies.filter((policy) => policy.namespace !== nextPolicy.namespace);

  return [...withoutCurrent, nextPolicy];
}

function isJsonOutput() {
  return program.opts().json === true;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printTable(rows) {
  if (rows.length === 0) {
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = columns.map((column) => Math.max(
    column.length,
    ...rows.map((row) => String(row[column] ?? '').length),
  ));
  const header = columns.map((column, index) => column.padEnd(widths[index])).join('  ');
  const body = rows.map((row) => columns
    .map((column, index) => String(row[column] ?? '').padEnd(widths[index]))
    .join('  '));

  console.log(header);
  for (const line of body) {
    console.log(line);
  }
}

function printError(error) {
  const payload = {
    error: {
      code: error.code || 'CLI_ERROR',
      message: sanitizeErrorMessage(error.message || 'Command failed'),
      details: sanitizeDetails(error.details),
    },
  };

  if (isJsonOutput()) {
    console.error(JSON.stringify(payload, null, 2));
    return;
  }

  console.error(`Error [${payload.error.code}]: ${payload.error.message}`);
  if (payload.error.details && Object.keys(payload.error.details).length > 0) {
    console.error(`Details: ${JSON.stringify(payload.error.details)}`);
  }
}

function sanitizeErrorMessage(message) {
  return String(message).replace(/usr_[A-Za-z0-9._:-]+/g, (token) => maskToken(token));
}

function sanitizeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(details).map(([key, value]) => [
    key,
    typeof value === 'string' ? sanitizeErrorMessage(value) : value,
  ]));
}

function maskToken(token) {
  if (!token) {
    return '';
  }

  return `${String(token).slice(0, tokenMaskLength)}...`;
}

function formatClusterStatus(cluster) {
  const agent = cluster.agent || {};
  const state = agent.state || {};
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];

  if (agent.status) {
    return agent.status;
  }

  if (nodes.some((node) => node.status === 'Ready')) {
    return 'Ready';
  }

  if (cluster.healthStatus) {
    return cluster.healthStatus;
  }

  return 'Unknown';
}

function formatNodeCount(cluster) {
  const nodes = cluster.agent?.state?.nodes;

  if (Array.isArray(nodes)) {
    return nodes.length;
  }

  return cluster.nodeName ? 1 : 0;
}

function formatLastSeen(cluster) {
  const timestamp = cluster.agent?.lastHeartbeatAt || cluster.lastSeenAt || cluster.updatedAt;

  if (!timestamp) {
    return '-';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

function formatBackupAge(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  if (value < 60) {
    return `${value}m`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

class CliError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

await program.parseAsync();
