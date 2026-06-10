# DR Platform Demo Scenario

## Purpose

This document is the repeatable final-presentation demo script for TASK-18.
It validates the full DR Platform flow with a controlled Pod Kill chaos scenario:

1. A critical workload fails on the user cluster.
2. Prometheus and Alertmanager detect the failure.
3. DR Platform receives the webhook event.
4. The dashboard recommends `order-service` as the highest-priority recovery target.
5. The operator approves recovery.
6. Velero restores the workload to Edge K3s.
7. The dashboard records recovery progress and actual RTO.

## Safety Rules

- Run this scenario only against the user workload namespace `order-service`.
- Do not run the chaos command against `k8s-master`, `edge-k3s`, Velero, Prometheus, or Alertmanager namespaces.
- Confirm a fresh backup is completed before deleting anything.
- Keep cluster credentials, dashboard tokens, SSH passwords, and zrok reserved tokens out of the demo notes.
- Stop the scenario if the current Kubernetes context is not the intended user cluster.

## Prerequisites Checklist

Complete this checklist before starting the live demo.

- [ ] Backend API is running and reachable.
- [ ] Dashboard is open in the browser.
- [ ] Dashboard is using the correct token-scoped user session if a user token is required.
- [ ] Cloud K8s and Edge K3s status cards are visible.
- [ ] Incident Stream is visible.
- [ ] AI Recovery Decision panel is visible.
- [ ] Restore Progress panel is visible or ready to appear after approval.
- [ ] Prometheus is scraping the user cluster.
- [ ] Alertmanager webhook points to the DR Platform API.
- [ ] Velero is installed and can reach the configured object storage.
- [ ] `order-service` namespace exists and pods are running.
- [ ] A fresh pre-chaos Velero backup has completed successfully.

## Demo Variables

Set these values in the presenter terminal before the demo if needed.

```bash
export WORKLOAD_NAMESPACE=order-service
export EDGE_NAMESPACE=order-service
export BACKUP_NAME=pre-chaos-$(date +%s)
```

Use the dashboard URL supplied by the current deployment. For example:

```text
https://<dashboard-share>.zrok.io/dashboard
```

## Step 1: Confirm Normal State

Command:

```bash
kubectl config current-context
kubectl get namespace "$WORKLOAD_NAMESPACE"
kubectl get pods -n "$WORKLOAD_NAMESPACE"
```

Expected output:

```text
order-service namespace exists.
All expected order-service pods are Running or Ready.
```

Dashboard checks:

- Cloud K8s is green or healthy.
- Edge K3s is Standby or healthy.
- Incident Stream has no active critical `order-service` outage.

Presenter notes:

```text
We start from a healthy cloud workload. The platform is watching the user cluster
through monitoring signals, and Edge K3s is ready as the recovery target.
```

## Step 2: Create a Fresh Pre-Chaos Backup

Command:

```bash
velero backup create "$BACKUP_NAME" --include-namespaces "$WORKLOAD_NAMESPACE" --wait
velero backup describe "$BACKUP_NAME"
```

Expected output:

```text
Phase: Completed
Errors: 0
```

Record:

```text
Backup name:
Backup completed at:
```

Presenter notes:

```text
Before injecting failure, we create a fresh recovery point. This keeps the demo
safe and makes the recovery result deterministic.
```

## Step 3: Start RTO Timer and Inject Failure

Record the start time as soon as the delete command is executed.

Command:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
kubectl delete namespace "$WORKLOAD_NAMESPACE"
```

Expected output:

```text
namespace "order-service" deleted
```

Record:

```text
Failure injected at:
```

Presenter notes:

```text
This simulates a critical service failure by removing the order-service
namespace from the primary user cluster. From this point, the RTO clock starts.
```

## Step 4: Confirm Monitoring Detection

Wait up to 2 minutes for Prometheus and Alertmanager to detect and forward the
failure.

Optional command if Alertmanager access is available:

```bash
kubectl get pods -A | grep -E 'prometheus|alertmanager'
```

Expected dashboard behavior:

- Incident Stream receives a firing alert for `order-service` or its namespace.
- Cloud K8s topology node changes to Outage or Warning.
- Alert appears within the target detection window.

Target:

```text
Alert detection: < 2 minutes
```

Record:

```text
Alert received in dashboard at:
Detection duration:
```

Presenter notes:

```text
The dashboard is not polling Kubernetes directly from the browser. The browser
receives sanitized platform API data after the backend ingests the monitoring
event from Alertmanager.
```

## Step 5: Confirm AI Recovery Decision

Dashboard checks:

- AI Recovery Decision panel refreshes after the alert is received.
- `order-service` appears as rank 1.
- The row includes score, tier, RTO/RPO policy context, and explanation.
- No secret values or raw shell commands are shown in the browser.

Target:

```text
Recommendation generation: < 30 seconds after alert context is active
```

Record:

```text
Recommendation visible at:
Rank 1 workload:
Score:
Recommendation duration:
```

Presenter notes:

```text
The orchestrator ranks recovery priority using service importance, current
health, labels, and backup freshness. For this scenario, order-service should be
the top recommendation because it is the failed critical workload.
```

## Step 6: Operator Approval

Dashboard action:

1. Click Approve for `order-service`.
2. Confirm the approval dialog.
3. Watch the Restore Progress panel appear.

Expected dashboard behavior:

- Approved badge appears for `order-service`.
- Edge K3s topology node changes to Restore or in-progress state.
- Restore Progress panel shows the restore name and elapsed timer.

Record:

```text
Operator approved at:
Restore name:
Restore started at:
```

Presenter notes:

```text
The platform keeps a human operator in the loop. The recommendation does not
execute recovery until the operator explicitly approves it.
```

## Step 7: Track Restore Completion

Dashboard checks:

- Restore Progress changes from InProgress to Completed.
- Errors remain at 0.
- Edge K3s node shows Recovered.
- Actual RTO appears in the dashboard.

Optional verification command:

```bash
velero restore get
velero restore describe <restore-name>
```

Expected output:

```text
Phase: Completed
Errors: 0
```

Target:

```text
Velero restore completion: < 5 minutes
Total RTO: < 10 minutes
```

Record:

```text
Restore completed at:
Restore duration:
Actual RTO:
```

Presenter notes:

```text
Recovery is complete when Velero reports a completed restore and the platform
marks Edge K3s as recovered. The important number here is the actual RTO from
failure injection or alert receipt to completed recovery.
```

## Step 8: Verify Recovered Workload on Edge K3s

Use the Edge K3s context or access method for this environment.

Command:

```bash
kubectl get namespace "$EDGE_NAMESPACE"
kubectl get pods -n "$EDGE_NAMESPACE"
kubectl get svc -n "$EDGE_NAMESPACE"
```

Expected output:

```text
order-service namespace exists on Edge K3s.
Restored pods are Running or becoming Ready.
Services are restored.
```

Presenter notes:

```text
The dashboard shows the platform-level recovery state, and the cluster command
confirms that workload objects are present on the recovery target.
```

## RTO Record

Use this table during each live run.

| Metric | Target | Actual |
|---|---:|---:|
| Alert detection | < 2 min | |
| Dashboard update after alert | < 10 sec | |
| AI recommendation generation | < 30 sec | |
| Velero restore completion | < 5 min | |
| Total RTO | < 10 min | |

Detailed timestamps:

| Event | Timestamp |
|---|---|
| Pre-chaos backup completed | |
| Failure injected | |
| Alert received in dashboard | |
| Rank 1 recommendation visible | |
| Operator approved restore | |
| Restore started | |
| Restore completed | |
| Edge K3s verified recovered | |

## Troubleshooting

### Alert Does Not Appear Within 2 Minutes

Check:

```bash
kubectl get pods -A | grep -E 'prometheus|alertmanager'
kubectl get events -A --sort-by=.lastTimestamp
```

Actions:

- Confirm Prometheus is scraping the user cluster.
- Confirm Alertmanager has the DR Platform webhook receiver configured.
- Confirm the platform API URL used by Alertmanager is reachable from the cluster.
- Confirm the dashboard is showing the correct environment and token scope.

### Recommendation Does Not Rank order-service First

Check:

```bash
kubectl get namespace "$WORKLOAD_NAMESPACE"
velero backup get
```

Actions:

- Confirm the active alert contains namespace or workload metadata for `order-service`.
- Confirm the recovery policy marks `order-service` as the most critical demo workload.
- Confirm a fresh successful backup exists.
- Refresh the AI Recovery Decision panel.

### Restore Does Not Start After Approval

Actions:

- Confirm the approval dialog was accepted.
- Confirm the backend API is reachable from the dashboard.
- Confirm the selected backup exists and completed successfully.
- Confirm Edge K3s restore readiness is healthy.
- Retry approval only if the dashboard did not create a restore record.

### Restore Hangs InProgress

Check:

```bash
velero restore get
velero restore describe <restore-name>
kubectl get pods -n "$EDGE_NAMESPACE"
kubectl get events -n "$EDGE_NAMESPACE" --sort-by=.lastTimestamp
```

Actions:

- Wait for Kubernetes image pulls and readiness probes if objects are still being created.
- Inspect restore warnings and errors from `velero restore describe`.
- Confirm required namespaces, storage classes, secrets, and image pull access exist on Edge K3s.
- If the restore failed, record the failure, keep the dashboard visible, and explain the failed retry path.

## Completion Criteria

- [ ] Pre-chaos backup created and confirmed Completed before scenario.
- [ ] `kubectl delete namespace order-service` triggers Prometheus alert within 2 minutes.
- [ ] Alertmanager webhook reaches DR Platform and appears in Incident Stream.
- [ ] AI recommendation panel shows `order-service` as rank 1.
- [ ] Operator approval triggers Velero restore to Edge K3s.
- [ ] Restore completes with 0 errors.
- [ ] Edge K3s topology node shows Recovered badge.
- [ ] Actual RTO recorded and within 10-minute target.
- [ ] Demo presenter notes are usable without extra project context.
