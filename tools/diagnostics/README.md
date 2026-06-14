# tools/diagnostics

API와 대시보드 상태를 빠르게 점검하는 진단 도구입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `check_endpoints.sh` | 주요 API endpoint의 HTTP status 확인 |
| `debug_dashboard.js` | 원격 대시보드/API 상태를 Node.js로 점검 |

토큰과 URL이 스크립트 안에 박혀 있을 수 있으므로, 실제 사용 전 현재 환경에 맞게 수정해야 합니다.
