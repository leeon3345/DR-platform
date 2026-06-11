# DR Platform Deployment

## Prerequisites

- Docker with Docker Compose
- A zrok account and local zrok CLI enabled on the deployment host
- `drctl` installed or linked locally

## 1. Configure The API

Copy the example environment file and fill in local-only secrets:

```bash
cp .env.api.example .env.api
```

Set `DR_SSH_PASSWORD` and any optional server-only values in `.env.api`. Do not commit `.env.api`; it is ignored by Git.

## 2. Start The Platform

```bash
docker compose up -d --build
```

The services listen locally at:

- API: `http://localhost:3001`
- Dashboard: `http://localhost:5173`

The dashboard container proxies browser requests from `/api` to the API service inside Docker Compose.

## 3. Verify Local Access

```bash
curl http://localhost:3001/api/clusters
curl -s http://localhost:5173 | grep "<title>"
```

## 4. Expose With zrok

For temporary public shares:

```bash
bash scripts/zrok-share.sh
```

For stable URLs, create reserved zrok shares outside Git-tracked files, then provide their reserved tokens as environment variables:

```bash
export ZROK_API_SHARE_NAME=<lowercase-api-share-name>
export ZROK_DASHBOARD_SHARE_NAME=<lowercase-dashboard-share-name>
bash scripts/zrok-share.sh
```

If you already have reserved share tokens, you can use them directly:

```bash
export ZROK_API_RESERVED_TOKEN=<api-reserved-share-token>
export ZROK_DASHBOARD_RESERVED_TOKEN=<dashboard-reserved-share-token>
bash scripts/zrok-share.sh
```

Copy the API and dashboard URLs printed by zrok. Keep zrok account tokens, share names, and reserved share tokens out of Git-tracked files.

## 5. Register An Operator

First, download and install `drctl` from your platform:

```bash
curl -sL <api-zrok-url>/api/download/install.sh | bash
```

Then, use the API zrok URL for CLI registration:

```bash
drctl init --platform <api-zrok-url> --name my-organization
```

The command stores the issued user token in the local `drctl` config and prints a dashboard URL containing that token.

## 6. Open The Dashboard

Open the dashboard zrok URL in a browser. If `drctl init` printed a tokenized dashboard URL, use that URL so the browser session can load token-scoped cluster data.

## 7. Install The Agent

Install `dr-agent` on the user cluster with the issued dashboard token and the API zrok URL as the platform endpoint. Keep Kubernetes credentials, Velero credentials, MinIO credentials, and platform tokens out of Git-tracked files.

```bash
helm repo add dr-platform <api-zrok-url>/api/download
helm repo update dr-platform
helm upgrade --install dr-agent dr-platform/dr-agent \
  --version 0.1.13 \
  --set agent.platformUrl=<api-zrok-url> \
  --set agent.clusterId=my-cluster \
  --set agent.token=<dashboard-token> \
  --set image.pullPolicy=Always
```

## Notes

- `docker-compose.yml` does not contain plaintext secrets.
- Runtime registry data is mounted from `./server/registry` and is not baked into the API image.
- Browser-side code never executes shell commands; CLI, SSH, Velero, and Kubernetes operations remain backend-side.
