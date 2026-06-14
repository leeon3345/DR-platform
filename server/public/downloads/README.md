# server/public/downloads

사용자가 대시보드에서 내려받는 설치 파일과 binary를 보관합니다.

## 구조

| 파일 패턴 | 역할 |
| --- | --- |
| `dr-agent-*.tgz` | Helm chart 패키지 |
| `drctl-*` | OS/아키텍처별 `drctl` 실행 파일 |
| `install.sh` | agent 설치 보조 스크립트 |
| `index.yaml` | Helm repository index |

CLI binary는 `cli` 패키지의 빌드 결과로 갱신됩니다.
