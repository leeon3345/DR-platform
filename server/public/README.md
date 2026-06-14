# server/public

API 서버가 정적으로 제공하는 다운로드 리소스의 상위 폴더입니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `downloads/` | agent Helm chart, `drctl` binary, 설치 스크립트 |

대시보드의 다운로드 페이지와 `/api/download/*` endpoint가 이 폴더의 파일을 참조합니다.
