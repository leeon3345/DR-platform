# server/registry

데모와 개발 환경에서 사용하는 JSON 기반 런타임 저장소입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `clusters.json` | 등록된 클러스터 프로필, capability, agent 상태 |
| `alert-history.json` | Alertmanager webhook으로 수신한 최근 이벤트 |
| `recovery-policy.json` | 네임스페이스별 복구 정책 |
| `tokens.json` | 운영자/사용자 토큰 |
| `rto-history.json` | 장애 감지부터 복구 완료까지의 RTO 이력 |

## 주의사항

`clusters.json`과 `alert-history.json`은 데모 상태를 보여주기 위해 추적될 수 있지만, token, policy, RTO history처럼 민감하거나 실행 중 바뀌는 파일은 `.gitignore` 대상으로 관리합니다.
