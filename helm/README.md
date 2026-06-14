# helm

사용자 Kubernetes 클러스터에 `dr-agent`를 설치하기 위한 Helm chart입니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `dr-agent/Chart.yaml` | chart 이름과 버전 |
| `dr-agent/values.yaml` | image, platform URL, cluster id, token 기본값 |
| `dr-agent/templates/deployment.yaml` | agent Deployment |
| `dr-agent/templates/role.yaml` | agent가 접근할 Kubernetes 리소스 권한 |
| `dr-agent/templates/rolebinding.yaml` | Role과 ServiceAccount 연결 |
| `dr-agent/templates/secret.yaml` | 플랫폼 token 등 민감 설정 |
| `dr-agent/templates/serviceaccount.yaml` | agent 실행 계정 |

## 설치 흐름

대시보드 다운로드 페이지는 이 chart를 기반으로 사용자가 실행할 Helm 명령을 제공합니다. 설치된 agent는 플랫폼 URL, cluster id, token을 사용해 API 서버와 통신합니다.
