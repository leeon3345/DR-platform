# TASK-11 Done: Implement dr-agent

## Summary

Implemented `dr-agent` as a lightweight Node.js user-cluster agent and added platform-side agent APIs.

The platform now supports user clusters that push heartbeat state instead of requiring platform SSH access. Agent tokens are validated on every request and stored only as SHA-256 hashes in the registry.

## Added

- `POST /api/agent/register`
- `POST /api/agent/heartbeat`
- `GET /api/agent/commands?token=...&clusterId=...`
- `POST /api/agent/status`
- Dynamic `GET /api/clusters/:clusterId/status` for agent-backed clusters
- `user-k8s` registry kind with `agent` Kubernetes access mode
- Agent-reported node, workload, backup, heartbeat, and restore status state in the TASK-04 registry
- In-memory agent restore command queue for allowlisted Velero restore commands
- `agent/dr-agent.mjs` Node.js agent
- `agent/Dockerfile` image containing Node.js, `kubectl`, and `velero`
- `helm/dr-agent` chart with Secret-backed token handling and RBAC
- Dashboard cluster-list mapping for agent-reported cluster state

## Safety Notes

- Plaintext agent tokens are not stored in Git-tracked registry files.
- Registry stores `agentAuthHash` only.
- Agent endpoints validate `clusterId` and token on every request.
- Agent command execution is allowlisted to Velero restore creation only.
- Agent uses `execFile` with argument arrays instead of arbitrary shell strings.
- Browser code still does not execute shell commands.
- Alert ingestion remains decoupled from restore execution.

## Verification

- `node --check server/server.mjs`
- `node --check server/cluster-registry.mjs`
- `node --check agent/dr-agent.mjs`
- `npm run build`
- `docker build -t dr-agent:latest ./agent`
- API server startup on `http://127.0.0.1:3998`
- `POST /api/agent/register` with fake token `usr_task11test`
- `POST /api/agent/heartbeat` with fake node/workload/backup payload
- `GET /api/agent/commands` returned an empty command list
- `POST /api/agent/status` accepted a fake restore status update
- Invalid token heartbeat returned structured `INVALID_TOKEN`
- `GET /api/clusters/task11-agent-test/status` returned agent-backed Ready state during verification
- `GET /api/clusters/task11-agent-test/metrics` returned agent-backed workload, backup freshness, and restore readiness data during verification
- `GET /api/clusters/task11-agent-test/restores/restore-test-001` returned the agent-reported restore status during verification

The temporary `task11-agent-test` registry entry created during verification was removed after testing.

## Not Verified

- `helm lint helm/dr-agent` was not run because `helm` is not installed on this machine.
- Live Helm installation into the user cluster was not run because it would install a new agent workload and requires an operator-supplied real token/platform URL.
