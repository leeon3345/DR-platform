import os

# 1. Update api.js
with open("src/api.js", "r") as f:
    api_content = f.read()

delete_json_code = """
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
"""

if "deleteCluster" not in api_content:
    api_content += delete_json_code
    with open("src/api.js", "w") as f:
        f.write(api_content)
    print("Added deleteCluster to api.js")


# 2. Update App.jsx
with open("src/App.jsx", "r") as f:
    app_content = f.read()

# Add import
if "deleteCluster" not in app_content:
    app_content = app_content.replace(
        'import { getDashboardToken, initializeDashboardToken, loadDashboardData, approveRecovery } from "./api";',
        'import { getDashboardToken, initializeDashboardToken, loadDashboardData, approveRecovery, deleteCluster } from "./api";'
    )

# Modify ClusterList props to pass onDelete
if "function ClusterList({ clusters, activeClusterId, onSelect }) {" in app_content:
    app_content = app_content.replace(
        "function ClusterList({ clusters, activeClusterId, onSelect }) {",
        "function ClusterList({ clusters, activeClusterId, onSelect, onDelete }) {"
    )

# Add Delete Button to ClusterList card
old_card_html = """              <div className="flex items-start justify-between gap-3">
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
              </div>"""

new_card_html = """              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-950">{cluster.name}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {cluster.provider} · {cluster.region}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${cluster.statusBadge}`}>
                    <span className={`h-2 w-2 rounded-full ${cluster.statusDot}`} />
                    {cluster.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(cluster.id);
                    }}
                    className="rounded text-[11px] font-bold text-red-500 hover:bg-red-50 hover:text-red-600 px-2 py-1 border border-red-200 transition"
                    title="영구 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>"""

app_content = app_content.replace(old_card_html, new_card_html)

# Add handleDelete function inside Dashboard component
handle_delete_code = """
  const handleDeleteCluster = async (clusterId) => {
    if (window.confirm("정말 이 클러스터를 대시보드에서 영구적으로 삭제하시겠습니까?")) {
      try {
        await deleteCluster(clusterId);
        window.location.reload();
      } catch (err) {
        alert("삭제 중 오류가 발생했습니다: " + err.message);
      }
    }
  };
"""

# Inject handleDeleteCluster before <div className="mx-auto flex h-full max-w-[1600px] flex-col p-6">
if "handleDeleteCluster" not in app_content:
    app_content = app_content.replace(
        '<div className="mx-auto flex h-full max-w-[1600px] flex-col p-6">',
        handle_delete_code + '\n      <div className="mx-auto flex h-full max-w-[1600px] flex-col p-6">'
    )

# Update <ClusterList /> usage to pass onDelete={handleDeleteCluster}
app_content = app_content.replace(
    """<ClusterList
            clusters={dashboardClusters}
            activeClusterId={activeCluster.id}
            onSelect={setActiveClusterId}
          />""",
    """<ClusterList
            clusters={dashboardClusters}
            activeClusterId={activeCluster.id}
            onSelect={setActiveClusterId}
            onDelete={handleDeleteCluster}
          />"""
)

with open("src/App.jsx", "w") as f:
    f.write(app_content)
    print("Updated App.jsx successfully.")

