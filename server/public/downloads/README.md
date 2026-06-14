# server/public/downloads

사용자가 대시보드에서 내려받는 설치 파일을 보관합니다.

## 구조

| 파일 패턴 | 역할 |
| --- | --- |
| `dr-agent-*.tgz` | Helm chart 패키지 |
| `drctl-*` | OS/아키텍처별 CLI binary |
| `install.sh` | CLI 설치 보조 스크립트 |
| `index.yaml` | Helm repository index |

CLI binary와 chart package는 빌드 결과물이므로, 새 버전을 만들 때만 갱신합니다.
