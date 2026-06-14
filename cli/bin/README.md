# cli/bin

`drctl` CLI의 원본 엔트리포인트가 있는 폴더입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `drctl.mjs` | Commander 기반 CLI 구현 |

## 로직 요약

CLI는 로컬 설정에서 플랫폼 URL과 토큰을 읽고 API 서버를 호출합니다. `policy set` 명령은 기존 정책을 조회한 뒤 같은 namespace 항목을 병합해 `/recovery-policy` endpoint로 다시 저장합니다.
