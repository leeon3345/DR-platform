# server/public

API 서버가 정적으로 제공하는 다운로드 리소스를 담는 폴더입니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `downloads/` | agent Helm chart, 설치 스크립트, `drctl` binary 배포 파일 |

대시보드의 다운로드 페이지와 온보딩 명령어가 이 경로의 파일을 참조합니다.
