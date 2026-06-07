# DR Platform Project Overview

## Product Goal

DR Platform is a Cloud-Edge Disaster Recovery control plane for user-owned Kubernetes clusters.

The platform should let an operator:
- Register and manage user clusters through CLI-backed workflows.
- Monitor each cluster from a web dashboard.
- View cluster health, backup status, alerts, and restore readiness as metric-driven graphs and topology flows.
- Detect disaster events from monitoring signals.
- Decide or recommend restore priority for workloads.
- Execute restore operations into an Edge K3s recovery cluster.
- Verify that critical services are restored and ready for traffic failover.

The dashboard is not only a static visualization. It is intended to be the operator-facing control surface for real cluster state and real recovery actions.

## Core Concept

The system has two major surfaces:

1. CLI / backend orchestration layer
2. Web dashboard monitoring and recovery layer

The CLI/backend layer talks to real infrastructure tools:
- `kubectl`
- `k3s kubectl`
- `velero`
- MinIO / S3-compatible storage
- monitoring systems such as Zabbix
- future DR-specific commands such as `drctl`

The dashboard consumes normalized API data from that backend. The browser must not execute shell commands directly.

## Target User Flow

1. A user registers one or more Kubernetes clusters.
2. The backend stores cluster connection metadata and verifies reachability.
3. The platform collects cluster state and DR-related metrics.
4. The dashboard shows a cluster list.
5. When the operator selects a cluster, the dashboard shows:
   - node and workload health
   - backup status
   - MinIO / object storage connectivity
   - Velero backup location status
   - alert state
   - recovery target readiness
   - DR topology graph
6. If an incident occurs, monitoring sends an event to the orchestrator.
7. The orchestrator recommends restore priority based on workload labels, service importance, current health, and backup freshness.
8. The operator approves restore.
9. The backend runs the restore workflow through Velero and Kubernetes CLIs.
10. The dashboard tracks restore progress and final readiness.

## Cluster Model

The platform should treat clusters as first-class resources.

Each cluster should have at least:
- cluster ID
- display name
- cluster kind, such as `cloud-primary`, `edge-recovery`, `demo`, or `test`
- provider or environment label
- API endpoint or access profile
- node count
- Kubernetes version
- current health status
- backup configuration status
- restore target status

The dashboard should never assume there is only one hardcoded cluster.

## Dashboard Requirements

The dashboard should show a cluster list first.

After selecting a cluster, it should render that cluster's current DR state using:
- React Flow topology nodes
- animated edges for backup, alert, and restore flows
- status badges
- metric cards
- incident stream
- restore progress
- backup history
- validation status

The topology should be data-driven. The node and edge data should eventually come from backend APIs, not static frontend-only dummy data.

Expected dashboard entities:
- Cloud K8s primary cluster
- MinIO object storage
- Zabbix or monitoring source
- AI Orchestrator
- Edge K3s restore target

## CLI / Backend Responsibilities

The backend should expose safe APIs that wrap CLI operations.

Example API responsibilities:
- list registered clusters
- check cluster reachability
- fetch node and pod health
- fetch Velero backup locations
- fetch backup history
- create Velero backups
- create Velero restores
- check MinIO bucket connectivity
- ingest monitoring events
- produce recovery recommendations

Example API shape:

```http
GET /api/clusters
GET /api/clusters/:clusterId/status
GET /api/clusters/:clusterId/topology
GET /api/clusters/:clusterId/backups
POST /api/clusters/:clusterId/backups
POST /api/clusters/:clusterId/restores
POST /api/events/zabbix
```

The backend may internally call:

```bash
kubectl get nodes -o wide
kubectl get pods -A -o wide
velero backup-location get
velero backup create ...
velero restore create ...
```

## Current Lab Environment

Current local VM topology:

| Role | VM / Node | IP | SSH |
|---|---|---:|---|
| Cloud K8s primary | `k8s-master` | `10.0.2.10` | `ssh -p 2222 leeon@127.0.0.1` |
| Edge K3s restore target | `edge-k3s` | `10.0.2.11` | `ssh -p 2223 leeon@127.0.0.1` |

Current MinIO endpoint for Velero from `k8s-master`:

```text
http://10.0.2.11:30900
```

Current Velero bucket:

```text
velero-backups
```

Current expected Velero backup location state:

```text
Available
```

## Important Implementation Rule

Do not hardcode this lab topology as the final product model.

The current `k8s-master`, `edge-k3s`, and MinIO setup is a demo/test environment. The product should evolve toward user-registered clusters and data-driven dashboard rendering.

## Near-Term Development Priorities

1. Stabilize Velero-MinIO backup connectivity.
2. Add a backend API that reads cluster and Velero status through CLI commands.
3. Replace static dashboard data with API responses.
4. Add a real cluster registry.
5. Add backup creation and restore execution APIs.
6. Add metric collection and graph visualizations for cluster status.
7. Add AI-based restore priority recommendations.
8. Add operator approval and restore progress tracking.
