# agent

사용자 Kubernetes 클러스터 안에서 실행되는 `dr-agent` 구현입니다. 플랫폼 API와 통신하며 클러스터 상태, 워크로드 상태, Velero 백업/복구 상태를 보고하고, 서버가 내려주는 제한된 명령을 수행합니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `dr-agent.mjs` | agent 메인 루프, heartbeat, 상태 수집, 명령 처리 |
| `Dockerfile` | agent 컨테이너 이미지 빌드 정의 |
| `package.json` | agent 런타임 메타데이터와 실행 스크립트 |

## 참고

agent는 임의 shell 실행기가 아니라 플랫폼에서 허용한 DR 관련 작업만 처리하도록 설계되어 있습니다.
