# TASK-14: Docker Compose Packaging and zrok Exposure

## Baseline: 0.1.12 -> 0.1.13

## Project Reference

This task follows `.context/PROJECT.md`, especially:

- The platform should let operators register and manage user clusters through CLI-backed workflows.
- The dashboard consumes normalized API data from the backend.

## Goal

Package the DR Platform backend API and frontend dashboard into a Docker Compose setup so operators can start the entire platform with a single command. Expose the dashboard and API externally using zrok so users outside the local network can access the dashboard and register agents.

## Work Scope

- Add `Dockerfile` for the backend API server.
- Add `Dockerfile` for the frontend dashboard (nginx-served static build).
- Add `docker-compose.yml` that starts both services.
- Add a zrok startup script that creates persistent named shares for API and dashboard.
- Write a `DEPLOY.md` quickstart guide for first-time setup.
- Keep plaintext secrets out of `docker-compose.yml`. Use environment variable files excluded from Git.

## Docker Compose Service Layout

```yaml
services:
  dr-api:
    build: .
    ports:
      - "3001:3001"
    env_file: .env.api      # excluded from Git
    volumes:
      - ./server/registry:/app/server/registry

  dr-dashboard:
    build: ./frontend
    ports:
      - "5173:80"
    environment:
      - VITE_API_URL=https://xxxx.zrok.io
```

## zrok Share Script

```bash
#!/bin/bash
# scripts/zrok-share.sh
zrok share public http://localhost:3001 --headless &
zrok share public http://localhost:5173 --headless &
echo "Sharing API and dashboard. Check zrok console for URLs."
```

## Environment File Shape (.env.api - excluded from Git)

```
DR_SSH_PASSWORD=<vm-ssh-password>
LLM_API_KEY=<llm-api-key>
ZROK_API_URL=https://xxxx.zrok.io
```

## DEPLOY.md Quickstart Structure

1. Prerequisites (Docker, zrok account, drctl)
2. Clone repository
3. Copy `.env.api.example` to `.env.api` and fill in secrets
4. `docker compose up -d`
5. Run `scripts/zrok-share.sh`
6. Copy API and dashboard zrok URLs
7. `drctl init --platform <api-zrok-url> --name <your-org>`
8. Install agent on user cluster with Helm
9. Open dashboard URL in browser

## Safety Rules

- Do not store plaintext SSH passwords, Kubernetes secrets, MinIO credentials, Velero credentials, or LLM API keys in `docker-compose.yml` or any Git-tracked file.
- Provide `.env.api.example` with placeholder values only.
- Add `.env.api` and `.env.*` to `.gitignore`.
- Do not expose the registry files containing cluster metadata or tokens in the Docker image layer.

## Expected Behavior

- `docker compose up -d` starts both API and dashboard services.
- API is accessible at `http://localhost:3001`.
- Dashboard is accessible at `http://localhost:5173`.
- zrok shares expose both services externally at stable URLs.
- Agent installed on user cluster can reach API via zrok URL.
- Dashboard loaded via zrok URL shows correct cluster data.

## Suggested Verification

```bash
# Start services
docker compose up -d

# Confirm API healthy
curl http://localhost:3001/api/clusters

# Confirm dashboard serves HTML
curl -s http://localhost:5173 | grep "<title>"

# Start zrok shares
bash scripts/zrok-share.sh

# Confirm external API reachable
curl https://xxxx.zrok.io/api/clusters
```

## Completion Criteria

- [ ] `Dockerfile` exists for backend API.
- [ ] `Dockerfile` exists for frontend dashboard.
- [ ] `docker-compose.yml` starts both services with one command.
- [ ] `.env.api.example` exists with placeholder values.
- [ ] `.env.api` is excluded from Git via `.gitignore`.
- [ ] zrok share script exposes API and dashboard externally.
- [ ] `DEPLOY.md` quickstart guide covers full setup flow.
- [ ] Agent on user cluster can reach API via zrok URL.
- [ ] Dashboard served via zrok URL loads and shows cluster data.
- [ ] No secrets committed to Git-tracked files.
