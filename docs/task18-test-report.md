# TASK-18 Demo Scenario Test Report

## Scope

This report records the TASK-18 demo scenario work and the non-destructive
verification attempted on 2026-06-10.

The destructive chaos step was not executed:

```bash
kubectl delete namespace order-service
```

No real namespace deletion, real Velero restore approval, or real workload
failover was performed.

## Work Completed

- Created `docs/demo-scenario.md` as the repeatable final-presentation demo script.
- Documented the pre-chaos backup requirement.
- Documented the `order-service` namespace failure scenario.
- Documented expected Alertmanager, Incident Stream, AI recommendation, operator
  approval, restore progress, Edge K3s recovered state, and RTO recording steps.
- Documented troubleshooting paths for missing alerts, wrong recommendation rank,
  restore start failures, and restore hangs.

## Non-Destructive Verification Results

### Local Tooling

| Check | Result |
|---|---|
| `kubectl` installed | Passed: `/usr/local/bin/kubectl` |
| `velero` installed on local PATH | Failed: command not found |
| Frontend dev server on `127.0.0.1:5173` before test | Failed: not running |
| Existing API on `127.0.0.1:3001` | Passed for `GET /api/clusters` |

### Kubernetes Access

`kubectl` could not validate the user cluster from the local shell because no
current context was configured. It fell back to `localhost:8080`.

Observed errors:

```text
error: current-context is not set
The connection to the server localhost:8080 was refused
```

### API Verification

A current workspace API instance was started on a temporary local port:

```bash
env API_PORT=3998 DR_SSH_PASSWORD=leeon npm run api
```

Result:

```text
DR Platform API listening on http://127.0.0.1:3998
```

Verified endpoints:

| Endpoint | Result |
|---|---|
| `GET /api/events/history` | Passed, returned an empty event list before mock alert |
| `GET /api/events/latest` | Passed, returned `event: null` before mock alert |
| `GET /api/clusters/edge-recovery/status` | Passed, Edge K3s reported `Ready` |
| `GET /api/clusters/edge-recovery/restore-readiness` | Passed, score `100`, status `Ready` |

Cloud-primary endpoints were blocked by SSH execution problems:

| Endpoint | Result |
|---|---|
| `GET /api/clusters/cloud-primary/status` | Failed with `COMMAND_ERROR` |
| `GET /api/clusters/cloud-primary/backups` | Failed with `COMMAND_ERROR` |
| `GET /api/clusters/cloud-primary/recommendations` | Failed with `COMMAND_ERROR` |

Observed backend error detail:

```text
Unexpected token 's', "spawn ssh "... is not valid JSON
```

### SSH Reachability

Direct non-destructive SSH checks showed:

| Target | Result |
|---|---|
| `127.0.0.1:2222` Cloud K8s VM | Failed: banner exchange timeout |
| `127.0.0.1:2223` Edge K3s VM | Reachable, but direct login denied without credentials |

Observed Cloud error:

```text
Connection timed out during banner exchange
Connection to 127.0.0.1 port 2222 timed out
```

Observed Edge error:

```text
Permission denied (publickey,password)
```

### Alertmanager Webhook Simulation

The correct Alertmanager receiver endpoint is:

```http
POST /api/events/alert
```

The earlier guessed path below was invalid:

```http
POST /api/events/alertmanager
```

Mock payload used:

```json
{
  "receiver": "dr-platform",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "NamespaceTerminating",
        "severity": "critical",
        "namespace": "order-service",
        "clusterId": "cloud-primary"
      },
      "annotations": {
        "summary": "order-service namespace failure demo"
      },
      "startsAt": "2026-06-10T10:30:00Z"
    }
  ]
}
```

Result:

- `POST /api/events/alert` accepted the payload.
- `GET /api/events/latest` returned the mock firing event.
- `GET /api/events/history` returned the mock firing event.
- The stored event normalized `clusterId` to `user-k8s`.

### Dashboard Check

The frontend dev server was started with the temporary API:

```bash
env VITE_API_BASE_URL=http://127.0.0.1:3998 npm run dev -- --host 127.0.0.1 --port 5173
```

Opening:

```text
http://127.0.0.1:5173/dashboard
```

Result:

- The route loaded.
- The dashboard showed `Dashboard token required`.
- Full Incident Stream UI verification was blocked because no temporary dashboard
  token was issued during this test.

## Blockers

- Local `kubectl` context is not configured for the user cluster.
- Local `velero` CLI is not installed or not on PATH.
- Cloud K8s SSH endpoint `127.0.0.1:2222` timed out.
- Cloud-primary API paths that depend on SSH could not return workload, backup,
  or recommendation data.
- Dashboard full UI verification requires a temporary dashboard token, which may
  update Git-ignored runtime registry data.
- TASK-14 Docker Compose, zrok exposure, external dashboard/API, and agent
  reachability live verification were not performed in this test.

## Current Status

TASK-18 is partially verified:

- Demo documentation is complete.
- Alertmanager webhook ingestion can be verified with a mock event.
- Event history/latest APIs can feed the Incident Stream.
- Edge K3s restore readiness is healthy.

TASK-18 is not fully end-to-end verified:

- No real pre-chaos Velero backup was created.
- No real `order-service` namespace deletion was performed.
- No real Prometheus alert timing was measured.
- No real AI recommendation rank 1 result was confirmed.
- No real operator approval or Velero restore was triggered.
- No workload-ready check after restore was measured.
- No actual RTO was recorded.

## Recommended Next Work

Use a new conversation for these larger follow-ups:

- Add RTO measurement visualization to the dashboard:
  - alert detected time
  - operator approval time
  - restore start time
  - restore completed time
  - workload ready time
  - per-stage durations and total RTO
- Live-verify TASK-14:
  - `docker compose up -d --build` with a real local `.env.api`
  - local API and dashboard reachability
  - zrok external API and dashboard URLs
  - token-scoped dashboard data through zrok
  - user-cluster agent reachability through zrok
- Re-run TASK-18 after fixing Cloud K8s SSH and local Velero availability.
