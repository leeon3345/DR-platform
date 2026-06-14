# agent

사용자 Kubernetes 클러스터 내부에서 실행되는 `dr-agent`입니다. 플랫폼 서버와 주기적으로 통신하며 클러스터 상태를 보고하고, 서버가 큐에 넣은 제한된 복구 명령을 수행합니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `dr-agent.mjs` | heartbeat, 상태 수집, 명령 처리 메인 루프 |
| `Dockerfile` | agent 컨테이너 이미지 정의 |
| `package.json` | agent 실행 스크립트 |

## 동작 흐름

1. agent가 플랫폼 API에 등록합니다.
2. 주기적으로 heartbeat를 보내며 Pod, backup, restore 상태를 보고합니다.
3. 서버의 command queue를 조회합니다.
4. 허용된 Velero backup/restore 명령만 실행합니다.
5. 실행 결과를 다시 플랫폼 API로 보고합니다.

## 보안 관점

agent는 임의 shell 실행기가 아니라 DR에 필요한 명령만 처리하도록 설계되어 있습니다. Kubernetes RBAC도 Helm chart에서 필요한 리소스 중심으로 제한합니다.
