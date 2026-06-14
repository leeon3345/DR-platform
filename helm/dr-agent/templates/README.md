# helm/dr-agent/templates

`dr-agent` Helm chart가 렌더링하는 Kubernetes 리소스 템플릿입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `_helpers.tpl` | chart 이름과 label helper |
| `deployment.yaml` | agent Deployment |
| `role.yaml` | agent가 읽거나 조작할 Kubernetes 리소스 권한 |
| `rolebinding.yaml` | ServiceAccount와 Role 연결 |
| `secret.yaml` | 플랫폼 API token 등 민감 설정 |
| `serviceaccount.yaml` | agent 실행용 ServiceAccount |
