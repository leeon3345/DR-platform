# DR Platform Project Notes

Last updated: 2026-06-11

## Current Public Test

- Dashboard: `https://drplatform.share.zrok.io/dashboard?token=usr_b7224d9e`
- API base: `https://drplatform.share.zrok.io/api`
- Active user cluster: `my-cluster`
- Agent chart: `dr-agent` `0.1.13`
- Agent image: `ttl.sh/dr-platform-agent:24h`

## Current Dashboard State

- `my-cluster` is connected by agent heartbeat.
- The restore approval test for `auth-service` is still recorded.
- Current restore name: `auth-service-restore-mq931hfv`
- Current restore phase: `Submitted`
- RTO timeline shows restore start, but no restore completion yet.
- `/api/events/history` is currently empty, so the dashboard shows "no incident event" in AI Recovery Decision.

The old incident alerts disappeared because Alertmanager webhook events were stored only in API memory. Rebuilding/restarting `dr-api` cleared that in-memory list. RTO history and recovery approvals are persisted separately in `server/registry/rto-history.json` and `server/registry/recovery-policy.json`, so those records remain.

The API has now been updated to persist new alert webhook events in `server/registry/alert-history.json` going forward.

## AI API Key

The AI key belongs on the DR Platform API host, not inside the user Kubernetes VM, unless the API itself is deployed in Kubernetes.

For the current local/docker-compose deployment, `.env.api` is treated as a secret file and is ignored by Git through `.gitignore`. Do not commit `.env.api`.

LLM responses are capped by `LLM_MAX_TOKENS`. The server defaults to `180` tokens and clamps the value between `60` and `300`.

For the current docker-compose deployment, update `.env.api` on the machine running `dr-api`:

```bash
cd /Users/leeon/Documents/DR-platform
perl -0pi -e 's/^LLM_API_KEY=.*/LLM_API_KEY=YOUR_OPENAI_API_KEY/m' .env.api
grep -q '^LLM_MODEL=' .env.api || printf '\nLLM_MODEL=gpt-4o-mini\n' >> .env.api
perl -0pi -e 's/^LLM_MODEL=.*/LLM_MODEL=gpt-4o-mini/m' .env.api
grep -q '^LLM_MAX_TOKENS=' .env.api || printf '\nLLM_MAX_TOKENS=180\n' >> .env.api
perl -0pi -e 's/^LLM_MAX_TOKENS=.*/LLM_MAX_TOKENS=180/m' .env.api
docker-compose up -d --force-recreate dr-api
```

If the platform API is deployed inside Kubernetes later, store the key as a Kubernetes Secret in the namespace where the API runs:

```bash
kubectl -n dr-platform create secret generic dr-platform-ai \
  --from-literal=LLM_API_KEY=YOUR_OPENAI_API_KEY \
  --from-literal=LLM_MODEL=gpt-4o-mini \
  --from-literal=LLM_MAX_TOKENS=180 \
  --dry-run=client -o yaml | kubectl apply -f -
```

## User Cluster Agent Install

Use the hosted Helm chart. Do not use `./helm/dr-agent` from the Kubernetes VM because that local path does not exist there.

```bash
helm repo add dr-platform https://drplatform.share.zrok.io/api/download
helm repo update dr-platform

helm upgrade --install dr-agent dr-platform/dr-agent \
  --version 0.1.13 \
  --set agent.platformUrl=https://drplatform.share.zrok.io \
  --set agent.clusterId=my-cluster \
  --set agent.token=usr_b7224d9e \
  --set image.pullPolicy=Always
```

If the repo was added before the chart archive fix:

```bash
helm repo remove dr-platform
helm repo add dr-platform https://drplatform.share.zrok.io/api/download
helm repo update dr-platform
```

## Release Commands

Review runtime registry files before staging. `server/registry/clusters.json` is live runtime state and usually should not be committed.

```bash
git add \
  DEPLOY.md \
  PROJECT.md \
  agent/dr-agent.mjs \
  helm/dr-agent/Chart.yaml \
  helm/dr-agent/templates/deployment.yaml \
  helm/dr-agent/values.yaml \
  server/cluster-registry.mjs \
  server/server.mjs \
  src/App.jsx \
  src/DownloadPage.jsx \
  src/api.js \
  task15.md

git add -f \
  server/public/downloads/index.yaml \
  server/public/downloads/dr-agent-0.1.13.tgz

git commit -m "fix user cluster restore and topology flows"
git tag -a v0.1.13 -m "dr-agent restore polling and namespace topology"
git push origin HEAD --follow-tags
```
