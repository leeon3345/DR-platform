const INTERNAL_API_PATHS = {
  clusters: "/api/clusters",
  cloudStatus: "/api/clusters/cloud-primary/status",
  edgeStatus: "/api/clusters/edge-recovery/status",
  minioStatus: "/api/storage/minio/status",
  veleroLocation: "/api/clusters/cloud-primary/velero/location",
  backups: "/api/clusters/cloud-primary/backups",
  cloudMetrics: "/api/clusters/cloud-primary/metrics",
  edgeMetrics: "/api/clusters/edge-recovery/metrics",
  cloudWorkloads: "/api/clusters/cloud-primary/workloads",
  edgeWorkloads: "/api/clusters/edge-recovery/workloads",
  cloudBackupFreshness: "/api/clusters/cloud-primary/backup-freshness",
  edgeRestoreReadiness: "/api/clusters/edge-recovery/restore-readiness",
  cloudRecommendations: "/api/clusters/cloud-primary/recommendations",
  cloudTopology: "/api/clusters/cloud-primary/topology",
  edgeTopology: "/api/clusters/edge-recovery/topology",
  cloudValidation: "/api/clusters/cloud-primary/validate",
  edgeValidation: "/api/clusters/edge-recovery/validate",
  cloudRtoHistory: "/api/clusters/cloud-primary/rto-history",
  latestEvent: "/api/events/latest",
  eventHistory: "/api/events/history",
};

const TENANT_API_PATHS = {
  clusters: "/api/clusters",
  latestEvent: "/api/events/latest",
  eventHistory: "/api/events/history",
};

const DASHBOARD_TOKEN_STORAGE_KEY = "dr-platform-dashboard-token";

export function initializeDashboardToken() {
  const urlToken = new URLSearchParams(window.location.search).get("token")?.trim();

  if (urlToken) {
    window.sessionStorage.setItem(DASHBOARD_TOKEN_STORAGE_KEY, urlToken);
    return urlToken;
  }

  return window.sessionStorage.getItem(DASHBOARD_TOKEN_STORAGE_KEY)?.trim() || "";
}

export function getDashboardToken() {
  return window.sessionStorage.getItem(DASHBOARD_TOKEN_STORAGE_KEY)?.trim() || "";
}

function getApiBaseUrls() {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)?.trim();
  const candidates = [
    configuredBaseUrl,
    "",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ];

  return candidates.filter((baseUrl, index) => baseUrl !== undefined && candidates.indexOf(baseUrl) === index);
}

function buildUrl(baseUrl, path) {
  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function getJson(path, { signal, auth = true } = {}) {
  let lastError = null;
  const token = auth ? getDashboardToken() : "";

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await fetch(buildUrl(baseUrl, path), {
        headers: buildHeaders(token),
        signal,
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      try {
        return text ? JSON.parse(text) : null;
      } catch {
        throw new Error("Invalid JSON response");
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new Error(lastError?.message ?? "API request failed");
}

async function postJson(path, { body, signal } = {}) {
  let lastError = null;
  const token = getDashboardToken();

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await fetch(buildUrl(baseUrl, path), {
        method: "POST",
        headers: buildHeaders(token, { json: true }),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      try {
        return text ? JSON.parse(text) : null;
      } catch {
        throw new Error("Invalid JSON response");
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new Error(lastError?.message ?? "API request failed");
}

function buildHeaders(token, { json = false } = {}) {
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function loadDashboardData({ signal } = {}) {
  const token = getDashboardToken();
  const paths = token ? TENANT_API_PATHS : INTERNAL_API_PATHS;
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, path]) => {
      try {
        const request = key.endsWith("Validation") ? postJson : getJson;

        return [key, { ok: true, data: await request(path, { signal }) }];
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }

        return [key, { ok: false, error: `${path}: ${error.message}` }];
      }
    }),
  );

  const apiResults = Object.fromEntries(entries);

  // If using TENANT_API_PATHS, we must dynamically populate the missing keys!
  if (token && apiResults.clusters?.ok) {
    const clustersList = apiResults.clusters.data?.items || apiResults.clusters.data?.clusters || [];
    
    if (clustersList.length > 0) {
      // Use the user's clusters to fill out the UI
      const primaryId = clustersList[0]?.id || "cloud-primary";
      const recoveryId = clustersList[1]?.id || primaryId;

      const dynamicPaths = {
        cloudStatus: `/api/clusters/${encodeURIComponent(primaryId)}/status`,
        edgeStatus: `/api/clusters/${encodeURIComponent(recoveryId)}/status`,
        minioStatus: "/api/storage/minio/status",
        veleroLocation: `/api/clusters/${encodeURIComponent(primaryId)}/velero/location`,
        backups: `/api/clusters/${encodeURIComponent(primaryId)}/backups`,
        cloudMetrics: `/api/clusters/${encodeURIComponent(primaryId)}/metrics`,
        edgeMetrics: `/api/clusters/${encodeURIComponent(recoveryId)}/metrics`,
        cloudWorkloads: `/api/clusters/${encodeURIComponent(primaryId)}/workloads`,
        edgeWorkloads: `/api/clusters/${encodeURIComponent(recoveryId)}/workloads`,
        cloudBackupFreshness: `/api/clusters/${encodeURIComponent(primaryId)}/backup-freshness`,
        edgeRestoreReadiness: `/api/clusters/${encodeURIComponent(recoveryId)}/restore-readiness`,
        cloudRecommendations: `/api/clusters/${encodeURIComponent(primaryId)}/recommendations`,
        cloudTopology: `/api/clusters/${encodeURIComponent(primaryId)}/topology`,
        edgeTopology: `/api/clusters/${encodeURIComponent(recoveryId)}/topology`,
        cloudValidation: `/api/clusters/${encodeURIComponent(primaryId)}/validate`,
        edgeValidation: `/api/clusters/${encodeURIComponent(recoveryId)}/validate`,
        cloudRtoHistory: `/api/clusters/${encodeURIComponent(primaryId)}/rto-history`,
      };

      const dynamicEntries = await Promise.all(
        Object.entries(dynamicPaths).map(async ([key, path]) => {
          try {
            const request = key.endsWith("Validation") ? postJson : getJson;
            return [key, { ok: true, data: await request(path, { signal }) }];
          } catch (error) {
            if (signal?.aborted) throw error;
            return [key, { ok: false, error: `${path}: ${error.message}` }];
          }
        }),
      );

      Object.assign(apiResults, Object.fromEntries(dynamicEntries));
    }
  }

  return apiResults;
}

export async function loadEventHistory({ signal } = {}) {
  return getJson(INTERNAL_API_PATHS.eventHistory, { signal });
}

export async function loadLatestEvent({ signal } = {}) {
  return getJson(INTERNAL_API_PATHS.latestEvent, { signal });
}

export async function loadRtoHistory(clusterId = "cloud-primary", { signal } = {}) {
  return getJson(`/api/clusters/${encodeURIComponent(clusterId)}/rto-history`, { signal, auth: false });
}

export async function approveRecoveryRecommendation(workloadId, { signal } = {}) {
  return postJson(`/api/clusters/cloud-primary/recommendations/${encodeURIComponent(workloadId)}/approve`, { signal });
}

export async function executeRecoveryRestore(workloadId, { signal } = {}) {
  const safeWorkloadId = toKubernetesName(workloadId);
  const restoreName = `${safeWorkloadId}-restore-${Date.now().toString(36)}`.slice(0, 63).replace(/-+$/, "");
  const targetClusterId = "edge-recovery";

  const payload = await postJson("/api/clusters/cloud-primary/restores", {
    body: {
      restoreName,
      backupName: "latest",
      targetClusterId,
      namespaces: [safeWorkloadId],
      confirm: true,
    },
    signal,
  });

  return {
    ...payload,
    requestedRestoreName: restoreName,
    requestedTargetClusterId: targetClusterId,
  };
}

export async function loadRestoreStatus(clusterId, restoreName, { signal } = {}) {
  return getJson(`/api/clusters/${encodeURIComponent(clusterId)}/restores/${encodeURIComponent(restoreName)}`, { signal });
}

function toKubernetesName(value) {
  return String(value || "workload")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40) || "workload";
}

async function deleteJson(path, { signal } = {}) {
  let lastError = null;
  const token = getDashboardToken();

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await fetch(buildUrl(baseUrl, path), {
        method: "DELETE",
        headers: buildHeaders(token),
        signal,
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      try {
        return text ? JSON.parse(text) : null;
      } catch {
        throw new Error("Invalid JSON response");
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new Error(lastError?.message ?? "API request failed");
}

export async function deleteCluster(clusterId) {
  return deleteJson(`/api/clusters/${encodeURIComponent(clusterId)}`);
}
