# server/registry

개발 및 데모 환경에서 사용하는 로컬 JSON 저장소입니다. 운영 DB 대신 파일 기반으로 클러스터 상태, alert history, 정책, 토큰, RTO 이력을 보관합니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `clusters.json` | 등록된 클러스터 프로필과 agent 상태 |
| `alert-history.json` | Alertmanager webhook으로 수신한 최근 이벤트 |
| `recovery-policy.json` | 네임스페이스별 복구 정책 |
| `tokens.json` | 사용자 토큰 레지스트리 |
| `rto-history.json` | alert 감지부터 복구 완료까지의 RTO 기록 |

일부 파일은 `.gitignore` 대상입니다. 실제 운영 환경에서는 DB나 Secret Manager로 대체하는 것이 안전합니다.
