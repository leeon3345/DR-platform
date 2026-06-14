# deploy

Docker 기반 로컬 실행과 배포 이미지를 정의하는 폴더입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `Dockerfile.api` | Node.js API 서버 이미지 빌드 |
| `Dockerfile.dashboard` | React 대시보드 빌드 후 nginx로 서빙 |
| `docker-compose.yml` | API 서버와 대시보드를 함께 실행 |

## 실행

루트에서 다음 명령을 실행합니다.

```bash
cp config/env.api.example .env.api
docker compose -f deploy/docker-compose.yml up -d --build
```

Compose 파일은 `deploy/` 아래에 있으므로 build context는 `..`로 설정되어 있습니다. API 서버는 `3001`, 대시보드는 `5173` 포트로 열립니다.

## 컨테이너 구성

- `dr-api`: `server/server.mjs`를 실행하며 registry JSON을 volume으로 마운트합니다.
- `dr-dashboard`: Vite 빌드 결과를 nginx로 제공하고 `/api` 요청을 `dr-api`로 프록시합니다.
