# DR Platform Checklist

## TASK-01: Stabilize Velero-MinIO Backup Connectivity

Status: Done

- [x] Verify SSH reachability to Cloud K8s through `127.0.0.1:2222`.
- [x] Verify SSH reachability to Edge K3s through `127.0.0.1:2223`.
- [x] Confirm `k8s-master` is `Ready`.
- [x] Confirm `edge-k3s` is `Ready`.
- [x] Confirm Edge MinIO service exposes API NodePort `30900`.
- [x] Confirm expected MinIO API endpoint from `k8s-master` is `http://10.0.2.11:30900`.
- [x] Confirm Velero `BackupStorageLocation/default` is `Available`.
- [x] Confirm Velero bucket is `velero-backups`.
- [x] Confirm Velero `s3Url` is `http://10.0.2.11:30900`.
- [x] Compare Velero cloud credential secret with `/home/leeon/credentials-velero` without printing secret values.
- [x] Run manual Velero smoke backup.
- [x] Confirm smoke backup completes with `0` errors and `0` warnings.
- [x] Confirm smoke backup object files are visible in MinIO.
- [x] Record TASK-01 completion details in `task1-done.md`.

TASK-01 verified values:
- Smoke backup: `task1-smoke-20260607012840`
- MinIO bucket: `velero-backups`
- MinIO API endpoint: `http://10.0.2.11:30900`
- Final `k8s-master` state: `Ready`
- Final `edge-k3s` state: `Ready`

## TASK-02: Add Backend Cluster and Velero Status APIs

Status: Done

- [x] Choose backend implementation shape.
- [x] Add local backend server.
- [x] Add read-only command runner with timeout handling.
- [x] Add `GET /api/clusters`.
- [x] Add Cloud K8s status API.
- [x] Add Edge K3s status API.
- [x] Add MinIO status API.
- [x] Add Velero BackupStorageLocation API.
- [x] Add Velero backup history API.
- [x] Normalize command output into dashboard-friendly JSON.
- [x] Return structured JSON errors without leaking secrets.
- [x] Add API verification commands or notes.

TASK-02 verified values:
- API server: `http://127.0.0.1:3001`
- Cloud K8s node: `k8s-master`, `Ready`
- Edge K3s node: `edge-k3s`, `Ready`
- MinIO API NodePort: `30900`
- MinIO API endpoint from `k8s-master`: `http://10.0.2.11:30900`
- Velero bucket: `velero-backups`
- Velero `s3Url`: `http://10.0.2.11:30900`
- Velero phase: `Available`
- Successful backup in API history: `task1-smoke-20260607012840`

## TASK-03: Connect Dashboard to Backend Status APIs

Status: Done

- [x] Add frontend API client utilities for the TASK-02 backend.
- [x] Load cluster list from `GET /api/clusters`.
- [x] Load Cloud K8s status from `GET /api/clusters/cloud-primary/status`.
- [x] Load Edge K3s status from `GET /api/clusters/edge-recovery/status`.
- [x] Load MinIO status from `GET /api/storage/minio/status`.
- [x] Load Velero location from `GET /api/clusters/cloud-primary/velero/location`.
- [x] Load Velero backup history from `GET /api/clusters/cloud-primary/backups`.
- [x] Preserve the current React Flow dashboard layout and node design.
- [x] Replace static status values with API-backed data where available.
- [x] Add loading and safe error states suitable for the dashboard.
- [x] Add structured error display for failed API calls without showing secrets.
- [x] Keep frontend code from executing shell commands directly.
- [x] Verify dashboard behavior with the backend API server running.
- [x] Improve topology label visibility and node spacing.
- [x] Remove confusing React Flow minimap and make fit-view show the full topology.

TASK-03 verified values:
- API server: `http://127.0.0.1:3001`
- Frontend dev server: `http://127.0.0.1:5173`
- Cloud K8s node rendered from API: `k8s-master`, `Ready`
- Edge K3s node rendered from API: `edge-k3s`, `Ready`
- MinIO API NodePort rendered from API: `30900`
- MinIO API endpoint rendered from API: `http://10.0.2.11:30900`
- Velero bucket rendered from API: `velero-backups`
- Velero `s3Url` rendered from API: `http://10.0.2.11:30900`
- Velero phase rendered from API: `Available`
- Backup history rendered from API: `task1-smoke-20260607012840`
- Build verification: `npm run build`

## TASK-04: Add Real Cluster Registry

Status: Done

- [x] Define cluster registry data model based on `PROJECT.md`.
- [x] Add local registry storage for non-secret cluster metadata.
- [x] Keep plaintext passwords, Kubernetes secrets, MinIO credentials, and Velero credentials out of Git-tracked files.
- [x] Preserve current lab clusters as seed registry entries.
- [x] Add registry-backed `GET /api/clusters`.
- [x] Add `GET /api/clusters/:clusterId`.
- [x] Add create or update API for cluster metadata.
- [x] Add delete API for cluster removal.
- [x] Add cluster validation API.
- [x] Validate supported cluster kinds: Cloud K8s primary and Edge K3s recovery.
- [x] Update existing status APIs to resolve cluster metadata from the registry where practical.
- [x] Keep the TASK-03 dashboard cluster selector compatible with registry-backed clusters.
- [x] Return safe structured errors for missing, invalid, or unreachable cluster profiles.
- [x] Verify backend API starts successfully.
- [x] Verify frontend dashboard still builds successfully.
- [x] Verify no browser-side code executes shell commands.

TASK-04 verified values:
- Registry seed file: `server/registry/clusters.json`
- Registry module: `server/cluster-registry.mjs`
- Seed clusters: `cloud-primary`, `edge-recovery`
- Supported cluster kinds: `cloud-k8s`, `edge-k3s`
- Supported Kubernetes access modes: `kubectl`, `k3s`
- Build verification: `npm run build`
- API verification port used because `3001` was already occupied: `http://127.0.0.1:3002`
- `GET /api/clusters`: returned registry-backed `cloud-primary` and `edge-recovery`
- `GET /api/clusters/cloud-primary`: returned non-secret cluster metadata
- `POST /api/clusters/cloud-primary/validate`: valid, `k8s-master` Ready
- `POST /api/clusters/edge-recovery/validate`: valid, `edge-k3s` Ready when `DR_SSH_PASSWORD` is supplied through the environment
- `GET /api/storage/minio/status`: NodePort `30900`, endpoint `http://10.0.2.11:30900`
- `GET /api/clusters/cloud-primary/velero/location`: phase `Available`, bucket `velero-backups`
- Safe error verification: missing cluster returns `CLUSTER_NOT_FOUND`
- Safe error verification: secret-like registry fields return `SECRET_FIELD_NOT_ALLOWED`

## TASK-05: Add Backup Creation and Restore Execution APIs

Status: Done

- [x] Define backend request/response contracts from `PROJECT.md` for backup creation and restore execution.
- [x] Add safe backup creation API for supported Cloud K8s registry profiles.
- [x] Add safe restore execution API for supported Edge K3s recovery profiles.
- [x] Add dry-run or preview mode before any restore execution.
- [x] Validate cluster registry capabilities before running Velero commands.
- [x] Validate backup names, namespaces, labels, TTL, and restore targets with allowlisted patterns.
- [x] Keep restore execution server-side only; do not execute shell commands in browser code.
- [x] Return structured command status without leaking secrets.
- [x] Add backup and restore status polling APIs.
- [x] Keep existing TASK-03 and TASK-04 dashboard behavior working.
- [x] Verify backend syntax for TASK-05 server modules.
- [x] Verify frontend dashboard still builds successfully.
- [x] Verify backend API server starts successfully.
- [x] Document operational safety constraints for live backup and restore checks.

TASK-05 verified values:
- Added `POST /api/clusters/:clusterId/backups`.
- Added `GET /api/clusters/:clusterId/backups/:backupName`.
- Added `POST /api/clusters/:clusterId/restores/preview`.
- Added `POST /api/clusters/:clusterId/restores`.
- Added `GET /api/clusters/:clusterId/restores/:restoreName`.
- Restore execution requires explicit `confirm: true`.
- Registry capability flags added for backup creation, backup status, restore preview, restore execution, and restore status.
- Build verification: `npm run build`.
- Syntax verification: `node --check server/server.mjs` and `node --check server/cluster-registry.mjs`.
- API startup verification port: `http://127.0.0.1:3999`.
- Live backup creation was not executed in this pass because it changes cluster backup state.
- Live restore execution was not executed in this pass because it changes target cluster state and requires explicit operator confirmation.

## TASK-06: Add Metric Collection and Graph Visualizations

Status: Done

- [x] Define backend metric response contracts from `PROJECT.md`.
- [x] Add safe cluster metric collection APIs for registered clusters.
- [x] Add workload health and restore-readiness metric APIs.
- [x] Add dashboard graph visualizations for cluster status, backup freshness, and restore readiness.
- [x] Keep graph data API-backed instead of static frontend-only dummy data.
- [x] Preserve existing topology, cluster selector, backup history, and registry behavior.
- [x] Return structured metric errors without leaking secrets.
- [x] Verify frontend build succeeds.
- [x] Verify backend API starts successfully.
- [x] Document metric source limitations and future monitoring integration points.

TASK-06 verified values:
- Added `GET /api/clusters/:clusterId/metrics`.
- Added `GET /api/clusters/:clusterId/workloads`.
- Added `GET /api/clusters/:clusterId/backup-freshness`.
- Added `GET /api/clusters/:clusterId/restore-readiness`.
- Added `GET /api/clusters/:clusterId/topology`.
- Build verification: `npm run build`.
- Syntax verification: `node --check server/server.mjs`, `node --check server/cluster-registry.mjs`, and `node --check src/api.js`.
- API startup verification port: `http://127.0.0.1:3998`.
- `GET /api/clusters`: returned registry-backed `cloud-primary` and `edge-recovery` with new metric capabilities.
- `GET /api/clusters/cloud-primary/topology`: returned registry-backed Cloud and Edge topology nodes and backup-source edge.
- `GET /api/clusters/edge-recovery/topology`: returned registry-backed Cloud and Edge topology nodes and restore-target edge.
- `GET /api/clusters/cloud-primary/metrics`: returned `k8s-master` Ready, `9/9` running pods, and latest backup freshness.
- `GET /api/clusters/cloud-primary/workloads`: returned `9` total pods, `9` running pods, `0` pending pods, and `0` failed pods.
- `GET /api/clusters/cloud-primary/backup-freshness`: returned latest backup `task1-smoke-20260607012840`, phase `Completed`, freshness `Stale`.
- Edge K3s live metric and restore-readiness verification requires `DR_SSH_PASSWORD`; without it the API returns sanitized `COMMAND_ERROR` details and does not expose secrets.

## Documentation Rules

- Keep task files focused on scope, constraints, and completion criteria.
- Keep execution checklists in this file.
- Keep completed task reports in separate `*-done.md` files.
- Do not store plaintext passwords, SSH passwords, Kubernetes secrets, or MinIO credentials in Git-tracked files.
