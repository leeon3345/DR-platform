# DR Platform

Kubernetes 재해 복구(DR) 실습 플랫폼입니다. React 대시보드, Node.js API, 클러스터 내 `dr-agent`, 운영자 CLI, Helm chart, 발표/보고서 산출물을 함께 포함합니다.

## 폴더 구조

| 경로 | 역할 |
| --- | --- |
| `src/` | React 대시보드 UI와 API 클라이언트 |
| `server/` | DR Platform API 서버, 정책 엔진, Alertmanager/agent 연동 |
| `agent/` | 사용자 Kubernetes 클러스터에 배포되는 경량 에이전트 |
| `cli/` | 운영자가 사용하는 `drctl` CLI |
| `helm/` | `dr-agent` 배포용 Helm chart |
| `docs/` | 데모 시나리오와 운영 검증 문서 |
| `deliverables/` | 최종 보고서, 발표 자료, 교수 질의응답 산출물 |
| `scripts/` | 보고서 생성, zrok 공유, 클러스터 보정용 보조 스크립트 |
| `public/` | 대시보드 정적 이미지 |
| `server/public/downloads/` | 대시보드에서 내려받는 agent/CLI 설치 파일 |

## 실행

```bash
npm install
npm run api
npm run dev
```

API 서버는 기본적으로 `127.0.0.1:3001`, 대시보드는 Vite 기본 포트에서 실행됩니다.

## 주요 문서

- `PROJECT.md`: 프로젝트 현황과 운영 메모
- `DEPLOY.md`: 배포 방법
- `docs/`: 데모 및 테스트 시나리오
- `deliverables/`: 최종 제출 산출물

## 핵심 동작 흐름

1. 운영자가 `drctl policy set`으로 네임스페이스별 `tier`, `RTO`, `RPO`를 등록합니다.
2. `dr-agent`가 사용자 클러스터의 Pod 상태, Velero 백업 목록, 복구 명령 상태를 API 서버로 보고합니다.
3. Alertmanager webhook이 장애 이벤트를 API 서버의 `/api/events/alert`로 전달합니다.
4. API 서버의 Policy Engine이 정책, 워크로드 상태, 백업 최신성을 조합해 복구 추천 점수를 계산합니다.
5. 대시보드는 추천 순위, 점수, 설명, 승인 버튼을 보여주고 운영자가 복구를 실행할 수 있게 합니다.

Policy Engine의 자세한 산식과 UI 반영 방식은 `docs/policy-engine.md`에 정리되어 있습니다.
