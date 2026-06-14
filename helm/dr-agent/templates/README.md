# helm/dr-agent/templates

Helm이 렌더링하는 Kubernetes 리소스 템플릿입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `_helpers.tpl` | 이름, label helper |
| `deployment.yaml` | agent Pod 실행 정의 |
| `role.yaml` | agent가 조회/조작할 Kubernetes 리소스 권한 |
| `rolebinding.yaml` | Role과 ServiceAccount 연결 |
| `secret.yaml` | 플랫폼 token 등 민감 설정 전달 |
| `serviceaccount.yaml` | agent 실행 계정 |

RBAC는 agent가 필요한 범위에서 Pod, backup, restore 상태를 조회하고 복구 명령을 수행할 수 있도록 구성합니다.
