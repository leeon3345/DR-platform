# TASK-06: Add Metric Collection and Graph Visualizations

## Baseline: 0.1.5 -> 0.1.6

## Project Reference

This task follows `.context/PROJECT.md`, especially:

- The dashboard should show real cluster health, backup status, restore readiness, and DR topology state.
- The topology and graphs should be data-driven through backend APIs.
- The backend should expose safe APIs that wrap CLI or monitoring operations.
- Browser-side code must not execute shell commands directly.
- Near-term priority 6 is to add metric collection and graph visualizations for cluster status.

## Goal

Add backend metric APIs and dashboard graph visualizations so operators can inspect cluster health, backup freshness, and restore readiness from normalized API data instead of static frontend-only values.

The first version can use Kubernetes, Velero, and registry-backed lab data. It should leave a clean path for future Zabbix or monitoring-system integration.

## Work Scope

- Add safe backend APIs for cluster metrics.
- Add workload health metrics for registered clusters.
- Add Velero backup freshness metrics for supported source clusters.
- Add restore target readiness metrics for supported recovery clusters.
- Add dashboard graph visualizations for metric trends or current state summaries.
- Keep metric data normalized and safe for dashboard consumption.
- Preserve TASK-03 dashboard behavior, TASK-04 registry APIs, and TASK-05 backup/restore APIs.
- Keep all CLI execution server-side only.
- Do not add AI Orchestrator or LLM integration yet.

## Suggested API Candidates

```http
GET /api/clusters/:clusterId/metrics
GET /api/clusters/:clusterId/workloads
GET /api/clusters/:clusterId/restore-readiness
GET /api/clusters/:clusterId/backup-freshness
GET /api/clusters/:clusterId/topology
```

Suggested cluster metric response shape:

```json
{
  "clusterId": "cloud-primary",
  "collectedAt": "2026-06-07T12:00:00.000Z",
  "node": {
    "ready": true,
    "kubernetesVersion": "v1.32.0"
  },
  "workloads": {
    "runningPods": 12,
    "pendingPods": 0,
    "failedPods": 0
  },
  "backupFreshness": {
    "latestBackupName": "manual-prod-20260607-120000",
    "latestBackupPhase": "Completed",
    "latestBackupTimestamp": "2026-06-07T12:00:00.000Z"
  }
}
```

## Safety Rules

- Do not store plaintext SSH passwords, Kubernetes secrets, MinIO credentials, or Velero credentials in Git-tracked files.
- Do not return Kubernetes secret values, environment secrets, or credential file contents from metric APIs.
- Do not execute shell commands in browser-side code.
- Do not make dashboard graphs depend on hardcoded lab-only values.
- Do not change Kubernetes, K3s, MinIO, Velero, or monitoring installations unless explicitly required and approved.
- Do not add AI Orchestrator or LLM recommendation logic in this task.

## Expected Backend Behavior

- Metric APIs resolve cluster metadata through the TASK-04 registry.
- Unsupported capabilities return structured errors such as `CAPABILITY_NOT_SUPPORTED`.
- Command failures return sanitized structured errors.
- Metric responses include `clusterId`, timestamps, status fields, and normalized counts suitable for graph rendering.
- Backup freshness uses Velero backup history where available.
- Restore readiness uses Edge K3s node/workload reachability where available.

## Expected Dashboard Behavior

- Existing topology and status cards continue to render.
- Cluster selector remains registry-backed.
- New graph or chart sections display API-backed cluster metrics.
- Loading, empty, and error states are visible without exposing secrets.
- Text and controls remain readable on desktop and mobile.

## Suggested Verification

Start the backend API:

```bash
DR_SSH_PASSWORD='<vm-password>' npm run api
```

Verify read-only state first:

```http
GET /api/clusters
POST /api/clusters/cloud-primary/validate
POST /api/clusters/edge-recovery/validate
GET /api/clusters/cloud-primary/backups
```

Verify new metric APIs:

```http
GET /api/clusters/cloud-primary/metrics
GET /api/clusters/edge-recovery/metrics
GET /api/clusters/cloud-primary/backup-freshness
GET /api/clusters/edge-recovery/restore-readiness
```

Verify frontend:

```bash
npm run build
```

## Completion Criteria

- Cluster metric API exists and is registry-backed.
- Workload health or pod summary API exists.
- Backup freshness API exists for supported source clusters.
- Restore readiness API exists for supported recovery clusters.
- Dashboard renders graph visualizations from backend metric APIs.
- Existing backup, restore, registry, and status APIs remain working.
- Browser-side code does not execute shell commands.
- API responses are normalized and safe for dashboard consumption.
- Backend API server starts successfully.
- Frontend build succeeds.
