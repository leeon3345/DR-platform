const API_PATHS = {
  clusters: "/api/clusters",
  cloudStatus: "/api/clusters/cloud-primary/status",
  edgeStatus: "/api/clusters/edge-recovery/status",
  minioStatus: "/api/storage/minio/status",
  veleroLocation: "/api/clusters/cloud-primary/velero/location",
  backups: "/api/clusters/cloud-primary/backups",
  cloudValidation: "/api/clusters/cloud-primary/validate",
  edgeValidation: "/api/clusters/edge-recovery/validate",
};

function getApiBaseUrls() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
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

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await fetch(buildUrl(baseUrl, path), {
        headers: { Accept: "application/json" },
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

async function postJson(path, { signal } = {}) {
  let lastError = null;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await fetch(buildUrl(baseUrl, path), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
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

export async function loadDashboardData({ signal } = {}) {
  const entries = await Promise.all(
    Object.entries(API_PATHS).map(async ([key, path]) => {
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
