# START_HERE

## Purpose

Use this file as the short boot note for a new AI chat.

Default new-chat prompt:

```text
Read .context/START_HERE.md and task12.md only.
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
- TASK-08: User-cluster test microservices deployed, DR labels applied, node-exporter confirmed, Velero installed through zrok-exposed Edge MinIO, and smoke backup verified.
- TASK-09: Prometheus Alertmanager webhook receiver, sanitized in-memory event history APIs, and dashboard incident polling added. User-cluster alert rule/agent installation is deferred to the next task.
- TASK-10: React Flow topology now responds to TASK-09 alert events, with API-polled node states, alert-aware edge animation, recovered badges, and live Incident Stream updates.
- TASK-11: `dr-agent` implemented as a Node.js Pod agent with registry-backed heartbeat ingestion, token-hash validation, allowlisted Velero restore command polling, Docker image packaging, Helm install chart, and dashboard cluster-list agent state reflection.
- TASK-12: Token-based user cluster isolation added with dashboard token issuance, Git-ignored token registry, scoped cluster APIs, agent registration ownership mapping, and dashboard URL/sessionStorage token handling.
- TASK-13: `drctl` CLI package added with core API-backed operator commands for registration, cluster listing/validation, policy updates, recommendations, JSON output, local config, safe errors, and local npm linking.
- TASK-14: Docker Compose packaging added for the backend API and nginx-served dashboard, with `.env.api.example`, zrok share helper script, deployment quickstart, dashboard `/api` proxying, and Git-ignored local env handling.
- TASK-15: Landing page (`/`) with hero, architecture flow, and feature cards added. Agent installation guide page (`/download`) with step-by-step onboarding flow added. React Router routes connect `/`, `/download`, and `/dashboard`. Platform URL reads from `VITE_PLATFORM_URL`. No API calls on public pages.
- TASK-16: Recovery Decision panel added below topology with ranked AI recommendations, explicit operator confirmation, recommendation approval, TASK-05 restore execution, same-session duplicate prevention, approved badges, manual refresh, empty/error states, and Edge K3s Restore topology state after restore trigger.
- TASK-17: Restore Progress panel added after operator approval, with restore execution response tracking, 10-second restore status polling, 1-second elapsed timer, progress phase display, RTO actual vs target, Failed retry path, and Edge K3s Recovered topology state after completion.

## Current Next Task

```text
TASK-18 should be drafted.
```

Likely next focus:
- Live-verify TASK-17 against a running backend and real Velero restore status transitions.
- Add restore workload readiness checks after Velero reports completion.
- Add richer restore history so completed progress survives page reloads.
- Consider extending restore progress tracking to token-owned user clusters if platform-side pending command creation is introduced.
- Live-verify TASK-14 with a real `.env.api`, `docker compose up -d --build`, zrok shares, external API/dashboard URLs, and an agent reaching the API through zrok.
- Add platform-side pending restore command creation tied to approved recommendations and token-owned target clusters.
- Provide Alertmanager webhook configuration and PrometheusRule manifests as installable assets if they should live beside the agent chart.
- Add dashboard and CLI operator flow to generate/copy a one-command `dr-agent` Helm install command that includes the issued dashboard token.
- Keep user-cluster credentials and tokens out of Git-tracked files.
- Keep alert ingestion decoupled from restore execution.
- Preserve the TASK-09 backend receiver and dashboard incident polling behavior.
- Keep all credential handling and CLI/SSH execution backend-only.
- Preserve TASK-07 deterministic scoring and server-only LLM explanation behavior.
- Account for the TASK-08 user-cluster workload labels and zrok-backed Velero storage path.

## Important Files

Frontend:

```text
src/App.jsx
src/LandingPage.jsx
src/DownloadPage.jsx
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
server/registry/tokens.json (local, Git-ignored)
```

Agent/install bundle:

```text
agent/dr-agent.mjs
agent/Dockerfile
helm/dr-agent
cli/bin/drctl.mjs
```

Packaging/deployment:

```text
Dockerfile
Dockerfile.dashboard
docker-compose.yml
.env.api.example
scripts/zrok-share.sh
DEPLOY.md
```

Project/task docs:

```text
.context/PROJECT.md
.context/checklist.md
.context/checklist2.md
.context/task8.md
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
User-cluster Velero endpoint through zrok: https://dr-minio.shares.zrok.io
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

Docker Compose:

```bash
cp .env.api.example .env.api
docker compose up -d --build
bash scripts/zrok-share.sh
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
POST /api/events/alert
GET /api/events/latest
GET /api/events/history
POST /api/agent/register
POST /api/agent/heartbeat
GET /api/agent/commands?token=<agent-token>&clusterId=<cluster-id>
POST /api/agent/status
POST /api/auth/register
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
