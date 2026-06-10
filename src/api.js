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

async function getJson(path, { signal } = {}) {
  let lastError = null;
  const token = getDashboardToken();

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

  return Object.fromEntries(entries);
}

export async function loadEventHistory({ signal } = {}) {
  return getJson(INTERNAL_API_PATHS.eventHistory, { signal });
}

export async function loadLatestEvent({ signal } = {}) {
  return getJson(INTERNAL_API_PATHS.latestEvent, { signal });
}

export async function approveRecoveryRecommendation(workloadId, { signal } = {}) {
  return postJson(`/api/clusters/cloud-primary/recommendations/${encodeURIComponent(workloadId)}/approve`, { signal });
}

export async function executeRecoveryRestore(workloadId, { signal } = {}) {
  return postJson("/api/clusters/cloud-primary/restores", {
    body: {
      backupName: "latest",
      targetNamespace: workloadId,
      confirm: true,
    },
    signal,
  });
}
