# DR Platform Checklist 2

## TASK-10: Topology Node Alert State UI

Status: Done

- [x] Poll `GET /api/events/latest` every 10 seconds from the dashboard.
- [x] Preserve initial event history loading from `GET /api/events/history`.
- [x] Normalize Alertmanager-style payloads and stored event payloads into one frontend alert event shape.
- [x] Map alert namespace and clusterId values to topology nodes.
- [x] Map `order-service` and `auth-service` alerts to the Cloud K8s node.
- [x] Map `NodeNotReady` alerts to the Cloud K8s node.
- [x] Map `alertmanager` source events to the Zabbix monitoring node.
- [x] Map `cloud-primary`, `prod-cloud-main`, and `user-k8s` cluster IDs to the Cloud K8s node.
- [x] Map `edge-recovery` and `edge-k3s` cluster IDs to the Edge K3s node.
- [x] Show critical firing alerts as red `Outage` state with pulse animation.
- [x] Show warning firing alerts as yellow `Warning` state.
- [x] Show resolved alerts as green `Recovered` state for 30 seconds.
- [x] Return affected nodes to existing safe/API-backed state after the recovered window expires.
- [x] Show AI Orchestrator as `Processing` while firing alert context is active.
- [x] Show Edge K3s as `Standby` while restore has not started.
- [x] Change edge animation to red dashed alert flow when an alert is firing.
- [x] Change edge animation to green dashed flow for normal and resolved states.
- [x] Preserve purple dashed restore flow when restore state is active.
- [x] Keep existing topology layout, node IDs, node positions, and React Flow node count unchanged.
- [x] Keep Incident Stream updating from API-polled alert events without page reload.
- [x] Keep browser-side code free of shell execution.
- [x] Verify frontend build succeeds.
- [x] Verify local dashboard renders with React Flow nodes and edges.

TASK-10 verified values:
- Updated files: `src/App.jsx`, `src/api.js`, `src/styles.css`.
- Added frontend API helper: `loadLatestEvent`.
- Latest event polling interval: `10000` ms.
- Resolved badge display window: `30000` ms.
- React Flow render verification: `5` nodes and `5` edges.
- Build verification: `npm run build`.
- Browser verification URL: `http://127.0.0.1:5173/`.
- Browser console verification: no error or warning logs observed.
- Backend API was not started during browser verification, so safe API warning UI was expected.

## TASK-11: Implement dr-agent

Status: Done

- [x] Implement `dr-agent` Node.js script to collect node, pod, and Velero backup state.
- [x] Package `dr-agent` as a Docker image.
- [x] Include `kubectl` and `velero` binaries in the agent image.
- [x] Add `POST /api/agent/register`.
- [x] Add `POST /api/agent/heartbeat`.
- [x] Add `GET /api/agent/commands`.
- [x] Add `POST /api/agent/status`.
- [x] Add `user-k8s` registry kind with agent access mode.
- [x] Store agent-reported state in the TASK-04 registry.
- [x] Store agent token hashes only; do not store plaintext tokens.
- [x] Validate token and clusterId on every agent request.
- [x] Return structured `INVALID_TOKEN` for token mismatch.
- [x] Add allowlisted Velero restore command execution in the agent.
- [x] Keep alert ingestion decoupled from restore execution.
- [x] Add Helm chart under `helm/dr-agent`.
- [x] Store agent token in a Kubernetes Secret template instead of committed values.
- [x] Add RBAC for node/pod reads and Velero backup/restore access.
- [x] Reflect agent-reported cluster state in the dashboard cluster list.
- [x] Verify backend syntax succeeds.
- [x] Verify frontend build succeeds.
- [x] Verify Docker image builds.

TASK-11 verified values:
- Agent package: `agent/dr-agent.mjs`.
- Agent image definition: `agent/Dockerfile`.
- Helm chart: `helm/dr-agent`.
- API startup verification port: `http://127.0.0.1:3998`.
- Fake verification cluster: `task11-agent-test`.
- Fake verification token: `usr_task11test`; removed after testing and not stored in final registry.
- `POST /api/agent/register`: created a `user-k8s` agent profile and returned public cluster data without exposing `agentAuthHash`.
- `POST /api/agent/heartbeat`: accepted node, workload, and backup state.
- `GET /api/agent/commands`: returned an empty list when no restore command was pending.
- `POST /api/agent/status`: accepted restore status for `restore-test-001`.
- Invalid token heartbeat returned structured `INVALID_TOKEN`.
- `GET /api/clusters/task11-agent-test/status`: returned `Ready` during verification.
- `GET /api/clusters/task11-agent-test/metrics`: returned agent-backed workload, backup freshness, and restore readiness data during verification.
- `GET /api/clusters/task11-agent-test/restores/restore-test-001`: returned the agent-reported restore status during verification.
- Syntax verification: `node --check server/server.mjs`, `node --check server/cluster-registry.mjs`, and `node --check agent/dr-agent.mjs`.
- Build verification: `npm run build`.
- Docker verification: `docker build -t dr-agent:latest ./agent`.
- Helm lint was not run because `helm` is not installed on this machine.
