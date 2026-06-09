# TASK-13: Implement drctl CLI Core Commands

## Baseline: 0.1.11 -> 0.1.12

## Project Reference

This task follows `.context/PROJECT.md`, especially:

- Register and manage user clusters through CLI-backed workflows.
- The CLI/backend layer talks to real infrastructure tools.
- Future DR-specific commands such as `drctl`.

## Goal

Build `drctl`, a command-line tool that wraps DR Platform backend API calls so operators can register clusters, define recovery policies, and trigger recommendations from a terminal without opening the dashboard.

`drctl` is a thin API client. All business logic stays in the backend. The CLI only formats requests and displays responses.

## Work Scope

- Implement `drctl` using Node.js and the `commander` package.
- Add the five core commands listed below.
- Read `PLATFORM_URL` and `CLUSTER_TOKEN` from environment variables or a local config file (`~/.drctl/config.json`).
- Format command output as human-readable tables or JSON with `--json` flag.
- Publish as a local npm package with `npm link` for development use.

## Core Commands

```bash
# Register with DR Platform and receive a token
drctl init --platform https://xxxx.zrok.io --name acme-corp

# List registered clusters for current token
drctl cluster list

# Validate cluster reachability via agent heartbeat
drctl cluster validate <clusterId>

# Define or update recovery policy for a namespace
drctl policy set <clusterId> \
  --namespace order-service \
  --tier critical \
  --rto 1h \
  --rpo 30m

# Fetch AI recovery recommendations for a cluster
drctl recommend <clusterId>
```

## Config File Shape

```json
{
  "platformUrl": "https://xxxx.zrok.io",
  "token": "usr_a3f2c891"
}
```

Written to `~/.drctl/config.json` after `drctl init`.

## Example Output

```bash
$ drctl cluster list
CLUSTER ID       KIND         STATUS    NODES   LAST SEEN
my-cluster       cloud-k8s    Ready     1       2s ago
my-cluster-2     cloud-k8s    Warning   1       45s ago

$ drctl recommend my-cluster
RANK  NAMESPACE       SCORE   TIER      BACKUP AGE
1     order-service   92      critical  23m
2     auth-service    78      high      45m
3     analytics       31      low       3h

AI Explanation (order-service):
order-service is ranked first. Backup is 23 minutes old, satisfying
the 30-minute RPO target. Tier is critical. All 3 pods are Running.
```

## Safety Rules

- Do not store plaintext passwords, Kubernetes secrets, MinIO credentials, or Velero credentials in the CLI config file.
- Do not execute kubectl, velero, or SSH commands from the CLI directly. All operations go through the DR Platform API.
- Do not commit `~/.drctl/config.json` to Git.
- Mask token value in verbose output. Show only first 8 characters.

## Expected Behavior

- `drctl init` calls `POST /api/auth/register`, writes config file, and prints the dashboard URL.
- `drctl cluster list` calls `GET /api/clusters` with stored token and prints a table.
- `drctl cluster validate <id>` calls `POST /api/clusters/:id/validate` and prints result.
- `drctl policy set` calls `POST /api/clusters/:id/recovery-policy` and confirms success.
- `drctl recommend` calls `GET /api/clusters/:id/recommendations` and prints ranked table with explanations.
- Unknown commands print help text.
- API errors print structured error code and message without exposing secrets.

## Suggested Verification

```bash
# Link CLI for local development
cd cli && npm install && npm link

# Run init
drctl init --platform http://127.0.0.1:3001 --name test-org

# Confirm config written
cat ~/.drctl/config.json

# List clusters
drctl cluster list

# Set policy
drctl policy set my-cluster \
  --namespace order-service \
  --tier critical \
  --rto 1h --rpo 30m

# Get recommendations
drctl recommend my-cluster
```

## Completion Criteria

- [x] `drctl init` registers with platform, stores token, and prints dashboard URL.
- [x] `drctl cluster list` returns token-scoped cluster table.
- [x] `drctl cluster validate` returns reachability result.
- [x] `drctl policy set` updates recovery policy via API.
- [x] `drctl recommend` prints ranked recommendations with AI explanations.
- [x] `--json` flag returns raw JSON output for all commands.
- [x] Config file written to `~/.drctl/config.json` and excluded from Git.
- [x] CLI does not execute kubectl, velero, or SSH commands directly.
- [x] API errors print structured message without exposing secrets.
- [x] `npm link` installs `drctl` as a global command successfully.
