# config

환경 변수 예시와 클러스터 접속 참고 파일을 보관하는 폴더입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `env.api.example` | API 서버 환경 변수 예시 |
| `kubeconfig-cloud-primary` | 실습용 cloud-primary kubeconfig 참고 파일 |

## 사용 방법

실행 전 루트에 `.env.api`를 생성합니다.

```bash
cp config/env.api.example .env.api
```

`.env.api`에는 SSH 비밀번호, LLM API key처럼 Git에 올리면 안 되는 값이 들어갈 수 있습니다. 실제 secret 파일은 루트에 생성하되 `.gitignore`로 제외합니다.
