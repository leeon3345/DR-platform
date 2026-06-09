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
