# helm/dr-agent

`dr-agent`를 사용자 Kubernetes 클러스터에 설치하기 위한 Helm chart입니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `Chart.yaml` | chart 이름, 버전, 설명 |
| `values.yaml` | 이미지, API URL, token 등 기본 설정 |
| `templates/` | Kubernetes manifest 템플릿 |

chart 패키지는 `server/public/downloads/dr-agent-*.tgz` 형태로 배포됩니다.
