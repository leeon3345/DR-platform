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

## TASK-12: Token Issuance and Cluster Isolation

Status: Done

- [x] Add `POST /api/auth/register` to issue `usr_<8 random hex chars>` dashboard tokens.
- [x] Return a dashboard URL with `?token=<token>` from registration.
- [x] Store token-to-cluster mappings in a local Git-ignored registry file.
- [x] Keep plaintext dashboard tokens out of Git-tracked files.
- [x] Add token validation for `Authorization: Bearer <token>`.
- [x] Add token validation for `?token=<token>`.
- [x] Scope `GET /api/clusters` to token-owned user clusters.
- [x] Scope cluster detail, status, metric, workload, backup, restore, topology, policy, and recommendation APIs by token ownership.
- [x] Return structured `INVALID_TOKEN` for missing or invalid user tokens.
- [x] Return `CLUSTER_NOT_FOUND` for cross-tenant cluster access.
- [x] Keep internal management cluster APIs accessible without token for `cloud-primary` and `edge-recovery`.
- [x] Prevent dashboard-token requests from reading internal management cluster APIs.
- [x] Map agent registration with a valid issued token to the token-owned cluster list.
- [x] Preserve existing agent token hash validation behavior.
- [x] Update dashboard API calls to send the stored token as an Authorization header.
- [x] Read dashboard token from URL query parameter on load.
- [x] Store dashboard token in `sessionStorage`.
- [x] Show registration guidance when the dashboard has no token.
- [x] Show only token-owned clusters in the dashboard cluster selector.
- [x] Verify backend syntax succeeds.
- [x] Verify frontend build succeeds.
- [x] Verify registration and token validation behavior through local API checks.

TASK-12 verified values:
- Updated backend files: `server/server.mjs`, `server/cluster-registry.mjs`.
- Updated frontend files: `src/api.js`, `src/App.jsx`.
- Updated ignore file: `.gitignore`.
- Token registry path: `server/registry/tokens.json`.
- Token registry Git handling: ignored by `.gitignore`.
- Registration endpoint: `POST /api/auth/register`.
- Token format verified: `usr_<8 lowercase hex chars>`.
- Valid token list check: `GET /api/clusters` returned only the token-owned cluster list.
- Invalid token check: `GET /api/clusters` with an invalid bearer token returned `401 INVALID_TOKEN`.
- Backend syntax verification: `node --check server/server.mjs`.
- Frontend build verification: `npm run build`.
- API verification port: `http://127.0.0.1:3999`.

## TASK-13: Implement drctl CLI Core Commands

Status: Done

- [x] Implement `drctl` using Node.js and `commander`.
- [x] Add `drctl init --platform <url> --name <name>`.
- [x] Add `drctl cluster list`.
- [x] Add `drctl cluster validate <clusterId>`.
- [x] Add `drctl policy set <clusterId> --namespace <namespace> --tier <tier> --rto <rto> --rpo <rpo>`.
- [x] Add `drctl recommend <clusterId>`.
- [x] Read `PLATFORM_URL` and `CLUSTER_TOKEN` from environment variables.
- [x] Read local config from `~/.drctl/config.json`.
- [x] Write config to `~/.drctl/config.json` after `drctl init`.
- [x] Format human-readable command output as tables or concise status text.
- [x] Support global `--json` output for all implemented commands.
- [x] Print structured API/CLI errors without exposing token values.
- [x] Mask token values in human-readable output.
- [x] Keep CLI as a thin API client with business logic in the backend.
- [x] Keep `kubectl`, `velero`, and SSH execution out of the CLI.
- [x] Publish locally with `npm link` for development use.

TASK-13 verified values:
- CLI package: `cli/package.json`.
- CLI entrypoint: `cli/bin/drctl.mjs`.
- CLI package version: `0.1.12`.
- Config path: `~/.drctl/config.json`.
- Dependency install verification: `npm install` inside `cli/`.
- Help verification: `node ./bin/drctl.mjs --help`.
- Missing config JSON error verification: `node ./bin/drctl.mjs --json cluster list`.
- Global link verification: `npm link`.
- Linked command verification: `drctl --help`.
- Temporary mock API verification covered `init`, `cluster list`, `cluster validate`, `policy set`, `recommend`, and success-case `--json`.

## TASK-14: Docker Compose Packaging and zrok Exposure

Status: Implementation Done, live zrok/agent verification pending

- [x] Add `Dockerfile` for backend API server.
- [x] Add `Dockerfile.dashboard` for nginx-served static dashboard build.
- [x] Add `docker-compose.yml` to start API and dashboard services together.
- [x] Mount `./server/registry` at runtime so registry files are not baked into the API image layer.
- [x] Add `.env.api.example` with placeholder values only.
- [x] Exclude `.env.api` and `.env.*` from Git while allowing `.env.api.example`.
- [x] Add zrok share script for API and dashboard exposure.
- [x] Support temporary public zrok shares.
- [x] Support stable zrok shares through share names or reserved share tokens supplied by local environment variables.
- [x] Add `DEPLOY.md` quickstart for Docker Compose, zrok, `drctl`, dashboard, and agent flow.
- [x] Keep plaintext secrets out of `docker-compose.yml` and Git-tracked deployment files.
- [x] Keep browser-side code free of shell execution.
- [x] Support both `VITE_API_BASE_URL` and `VITE_API_URL` for dashboard builds.
- [x] Add nginx `/api` proxy from dashboard container to `dr-api:3001`.
- [x] Verify frontend build succeeds.
- [x] Verify zrok script shell syntax succeeds.
- [ ] Verify `docker compose up -d --build` with a real local `.env.api`.
- [ ] Verify API is reachable at `http://localhost:3001`.
- [ ] Verify dashboard is reachable at `http://localhost:5173`.
- [ ] Verify zrok external API URL is reachable.
- [ ] Verify dashboard served through zrok loads token-scoped cluster data.
- [ ] Verify user-cluster agent can reach API through zrok.

TASK-14 verified values:
- Backend image file: `Dockerfile`.
- Dashboard image file: `Dockerfile.dashboard`.
- Compose file: `docker-compose.yml`.
- Local env example: `.env.api.example`.
- zrok helper: `scripts/zrok-share.sh`.
- Deployment guide: `DEPLOY.md`.
- API container bind: `0.0.0.0:3001`.
- API local URL: `http://localhost:3001`.
- Dashboard local URL: `http://localhost:5173`.
- Dashboard internal API proxy: `/api` -> `http://dr-api:3001/api/`.
- Build verification: `npm run build`.
- Whitespace verification: `git diff --check`.
- Script syntax verification: `bash -n scripts/zrok-share.sh`.
- Compose config was not fully verified because `.env.api` is intentionally not present in the repository.
