# server

DR Platform API 서버입니다. 클러스터 레지스트리, Alertmanager webhook, agent heartbeat, 복구 정책, 추천 점수 계산, backup/restore/failback orchestration을 담당합니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `server.mjs` | HTTP API 라우팅, 정책 엔진, 추천 생성, 복구 승인 처리 |
| `cluster-registry.mjs` | 클러스터 프로필과 capability 관리 |
| `command-runner.mjs` | SSH 명령 실행과 JSON 파싱 유틸리티 |
| `lab-config.mjs` | 실습 환경용 MinIO/클러스터 설정 |
| `registry/` | 로컬 JSON 기반 상태 저장소 |
| `public/downloads/` | agent Helm package와 CLI binary 다운로드 파일 |

## Policy Engine 요약

정책은 네임스페이스별 `tier`, `RTO`, `RPO`로 저장됩니다. 추천 점수는 tier 중요도, 백업 최신성, 워크로드 상태를 가중합해 계산하고, UI는 이 결과를 복구 우선순위와 추천 설명으로 표시합니다.

## 주요 API 흐름

| Endpoint | 역할 |
| --- | --- |
| `POST /api/events/alert` | Alertmanager 장애 이벤트 수신 |
| `GET /api/events/history` | 대시보드 장애 이벤트 조회 |
| `GET /api/clusters/:id/recovery-policy` | 클러스터별 복구 정책 조회 |
| `POST /api/clusters/:id/recovery-policy` | 복구 정책 생성/수정 |
| `GET /api/clusters/:id/recommendations` | Policy Engine 기반 복구 추천 생성 |
| `POST /api/clusters/:id/recommendations/:workloadId/approve` | 추천 승인 및 복구 명령 제출 |
| `POST /api/agent/heartbeat` | agent 상태/백업/워크로드 정보 수신 |

정책 엔진의 자세한 설명은 `docs/policy-engine.md`를 참고하세요.
