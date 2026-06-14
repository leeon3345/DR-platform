# helm/dr-agent

사용자 Kubernetes 클러스터에 `dr-agent`를 설치하는 Helm chart입니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `Chart.yaml` | chart 메타데이터 |
| `values.yaml` | image, platform URL, cluster id, token 설정 |
| `templates/` | Kubernetes manifest 템플릿 |

## 동작 로직

설치 시 `values.yaml`의 플랫폼 URL, cluster id, token이 agent Pod 환경 변수로 전달됩니다. agent는 이 값을 사용해 플랫폼 API에 heartbeat를 보내고 명령 큐를 조회합니다.
