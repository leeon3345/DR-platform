# START_HERE

## Purpose

Use this file as the short boot note for a new AI chat.

Default new-chat prompt:

```text
Read .context/START_HERE.md and .context/task7.md only.
Do not open other files unless I ask.

If you need more context, ask first and name the exact file.
Before editing, tell me which files you'll touch and what you'll do in each.
Wait for my confirmation, then begin.

설명은 한국어로.
```

## Repository

```text
/Users/leeon/Documents/DR-platform
```

## Project

DR Platform is a Cloud-Edge Disaster Recovery prototype.

Main product direction:
- Cloud K8s runs primary workloads.
- Edge K3s is the recovery target.
- MinIO stores Velero backups.
- Backend APIs wrap CLI/SSH operations.
- React dashboard consumes backend APIs.
- Browser-side code must not execute shell commands.

## Current Completed Tasks

- TASK-01: Velero-MinIO backup connectivity stabilized and verified.
- TASK-02: Backend cluster, MinIO, Velero, and backup status APIs added.
- TASK-03: Dashboard connected to backend status APIs.
- TASK-04: Real non-secret cluster registry added.
- TASK-05: Backup creation, restore preview, restore execution, and status APIs added.
- TASK-06: Metric collection APIs and dashboard graph visualizations added.
- TASK-07: Policy-based recovery priority recommendations, server-side LLM/fallback explanations, and dashboard approval panel added.

## Current Next Task

```text
.context/task8.md
```

TASK-08 should be drafted before the next implementation task.
Likely next focus:
- Connect approved recommendations to the existing TASK-05 restore preview/execution flow.
- Add restore progress tracking per approved workload.
- Keep all credential handling and CLI/SSH execution backend-only.
- Preserve TASK-07 deterministic scoring and server-only LLM explanation behavior.

## Important Files

Frontend:

```text
src/App.jsx
src/api.js
src/styles.css
```

Backend:

```text
server/server.mjs
server/command-runner.mjs
server/lab-config.mjs
server/cluster-registry.mjs
server/registry/clusters.json
server/registry/recovery-policy.json (local, Git-ignored)
```

Project/task docs:

```text
.context/PROJECT.md
.context/checklist.md
.context/task7.md
```

## Lab Cluster Registry

Registered clusters:

```text
cloud-primary
edge-recovery
```

Cloud K8s primary:

```text
Node: k8s-master
Node IP: 10.0.2.10
SSH: 127.0.0.1:2222
Kubernetes access mode: kubectl
```

Edge K3s recovery:

```text
Node: edge-k3s
Node IP: 10.0.2.11
SSH: 127.0.0.1:2223
Kubernetes access mode: k3s
```

MinIO / Velero:

```text
MinIO endpoint from k8s-master: http://10.0.2.11:30900
Velero bucket: velero-backups
Expected BackupStorageLocation phase: Available
```

## Commands

Backend API:

```bash
DR_SSH_PASSWORD='<vm-password>' npm run api
```

Frontend:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Build:

```bash
npm run build
```

Useful API checks:

```http
GET /api/clusters
GET /api/clusters/cloud-primary
POST /api/clusters/cloud-primary/validate
POST /api/clusters/edge-recovery/validate
GET /api/clusters/cloud-primary/status
GET /api/clusters/edge-recovery/status
GET /api/clusters/cloud-primary/metrics
GET /api/clusters/edge-recovery/metrics
GET /api/clusters/cloud-primary/workloads
GET /api/clusters/edge-recovery/workloads
GET /api/clusters/cloud-primary/backup-freshness
GET /api/clusters/edge-recovery/restore-readiness
GET /api/clusters/cloud-primary/topology
GET /api/clusters/edge-recovery/topology
GET /api/clusters/cloud-primary/recovery-policy
POST /api/clusters/cloud-primary/recovery-policy
GET /api/clusters/cloud-primary/recommendations
POST /api/clusters/cloud-primary/recommendations/:workloadId/approve
GET /api/clusters/cloud-primary/backups
GET /api/clusters/cloud-primary/backups/:backupName
POST /api/clusters/cloud-primary/backups
POST /api/clusters/cloud-primary/restores/preview
POST /api/clusters/cloud-primary/restores
GET /api/clusters/edge-recovery/restores/:restoreName
GET /api/clusters/cloud-primary/velero/location
GET /api/storage/minio/status
```

## Rules

- Do not store plaintext SSH passwords, Kubernetes secrets, MinIO credentials, or Velero credentials in Git-tracked files.
- Do not accept secret values in browser code or API request bodies.
- Do not move CLI command execution into the browser.
- Do not expose LLM API keys in browser code or API responses.
- Do not let LLM output change TASK-07 recommendation scores or rank.
- Backend API errors should be structured and sanitized.
- Prefer registry-backed cluster metadata instead of hardcoded cluster assumptions.
- Ask before reading extra files when the prompt limits file access.

## After Each Task

Update:

```text
.context/checklist.md
.context/START_HERE.md
.context/taskN-done.md or local handoff notes
.context/taskN+1.md
```

Keep this file short. Put detailed history in task-specific done files or local handoff notes.
