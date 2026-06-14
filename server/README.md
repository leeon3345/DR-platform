# server

DR Platform API 서버입니다. Alertmanager webhook, agent heartbeat, 클러스터 registry, 복구 정책 저장, Policy Engine 추천 계산, 복구 승인 처리를 담당합니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `server.mjs` | HTTP 라우팅, 정책 저장, 추천 점수 계산, 복구 승인 처리 |
| `cluster-registry.mjs` | 클러스터 프로필과 capability 관리 |
| `command-runner.mjs` | SSH 명령 실행과 JSON 출력 파싱 |
| `lab-config.mjs` | 실습 환경용 MinIO/클러스터 설정 |
| `registry/` | 데모/개발용 JSON 상태 저장소 |
| `public/downloads/` | agent chart와 CLI 다운로드 파일 |

## 핵심 로직

서버는 다음 데이터를 조합해 복구 추천을 생성합니다.

1. `recovery-policy`: 네임스페이스별 `tier`, `rto`, `rpo`
2. workload health: namespace별 Pod 상태
3. backup history: Velero backup 성공 여부와 최신 백업 시각
4. alert history: Alertmanager firing/resolved 이벤트
5. approvals: 운영자가 승인한 복구 요청 상태

추천 점수는 `server.mjs`의 Policy Engine 함수에서 계산됩니다.

```text
score = tierWeight * 0.4 + backupFreshness * 0.4 + workloadHealth * 0.2
```

## 주요 API

| Endpoint | 역할 |
| --- | --- |
| `POST /api/auth/register` | 운영자 토큰 발급 |
| `POST /api/events/alert` | Alertmanager 이벤트 수신 |
| `GET /api/events/history` | 최근 장애 이벤트 조회 |
| `POST /api/agent/register` | agent 등록 |
| `POST /api/agent/heartbeat` | agent heartbeat와 상태 수신 |
| `GET /api/clusters/:id/recovery-policy` | 복구 정책 조회 |
| `POST /api/clusters/:id/recovery-policy` | 복구 정책 저장 |
| `GET /api/clusters/:id/recommendations` | 복구 추천 생성 |
| `POST /api/clusters/:id/recommendations/:workloadId/approve` | 추천 승인 및 복구 요청 |

## 저장소 주의사항

`server/registry/*.json`은 데모용 파일 저장소입니다. 실제 운영 환경에서는 DB, Secret Manager, object storage 등으로 분리하는 것이 좋습니다.
