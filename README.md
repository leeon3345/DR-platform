# DR Platform

Kubernetes 기반 재해 복구(DR) 실습 플랫폼입니다. 대시보드, API 서버, 클러스터 에이전트, 운영자 CLI, Helm chart를 함께 제공해 장애 탐지부터 복구 추천, 승인, 복구 실행, failback까지 한 흐름으로 확인할 수 있습니다.

## 핵심 기능

- Alertmanager webhook을 통한 장애 이벤트 수신
- `dr-agent`를 통한 사용자 클러스터 상태, Pod 상태, Velero 백업 상태 수집
- 네임스페이스별 `tier`, `RTO`, `RPO` 복구 정책 등록
- Policy Engine 기반 복구 우선순위 점수 계산
- 대시보드에서 복구 추천, AI 설명, 승인, 복구 진행률 표시
- Velero 기반 backup/restore/failback 실습 흐름 제공
- `drctl` CLI와 Helm chart를 통한 온보딩 자동화

## 전체 구조

```text
DR-platform/
├── src/                         # React 대시보드
├── server/                      # Node.js API 서버와 Policy Engine
├── agent/                       # 사용자 클러스터 안에서 실행되는 dr-agent
├── cli/                         # 운영자용 drctl CLI
├── helm/                        # dr-agent 배포용 Helm chart
├── docs/                        # 핵심 설명 문서
├── deliverables/                # 최종 보고서와 발표 산출물
├── scripts/                     # 배포/보고서/실습 보조 스크립트
├── tools/mjs/                   # 루트에서 분리한 MJS 진단/테스트 유틸
├── public/                      # 대시보드 정적 이미지
├── Dockerfile                   # API 서버 이미지 빌드
├── Dockerfile.dashboard         # 대시보드 이미지 빌드
├── docker-compose.yml           # 로컬 통합 실행 구성
├── package.json                 # 루트 앱 실행 스크립트와 프론트엔드 의존성
└── README.md                    # 프로젝트 전체 설명
```

## 폴더별 상세 설명

| 경로 | 설명 |
| --- | --- |
| `src/` | React 대시보드 소스입니다. 클러스터 상태, 백업 최신성, 복구 추천, topology, restore progress, failback 화면을 렌더링합니다. |
| `src/App.jsx` | 대시보드의 핵심 화면과 상태 조합 로직입니다. Policy Engine 추천 결과를 테이블과 설명 문구로 표시합니다. |
| `src/api.js` | 프론트엔드가 호출하는 API endpoint와 fetch helper를 정의합니다. |
| `src/DownloadPage.jsx` | `drctl`, `dr-agent` 설치 안내와 다운로드 화면입니다. |
| `src/LandingPage.jsx` | 플랫폼 소개 화면입니다. |
| `server/` | API 서버 영역입니다. Alertmanager webhook, agent heartbeat, 클러스터 registry, recovery policy, recommendation API를 담당합니다. |
| `server/server.mjs` | HTTP 라우팅, Policy Engine 점수 계산, 추천 설명 생성, 복구 승인 처리의 중심 파일입니다. |
| `server/cluster-registry.mjs` | 클러스터 프로필과 capability를 관리합니다. |
| `server/command-runner.mjs` | SSH 명령 실행과 JSON 출력 파싱을 담당합니다. |
| `server/lab-config.mjs` | 실습 환경에서 사용하는 MinIO와 클러스터 설정입니다. |
| `server/registry/` | 데모/개발용 JSON 저장소입니다. 클러스터 상태와 alert history 등을 저장합니다. |
| `server/public/downloads/` | 대시보드에서 내려받는 `dr-agent` Helm package, `drctl` binary, 설치 스크립트를 보관합니다. |
| `agent/` | 사용자 Kubernetes 클러스터에 배포되는 에이전트입니다. Pod, backup, restore 상태를 수집하고 서버 명령 큐를 처리합니다. |
| `agent/dr-agent.mjs` | agent 메인 루프입니다. heartbeat, 상태 수집, Velero 명령 처리 로직이 들어 있습니다. |
| `cli/` | `drctl` CLI 패키지입니다. 플랫폼 등록, 정책 설정, 추천 조회를 터미널에서 수행합니다. |
| `cli/bin/drctl.mjs` | CLI 원본 구현입니다. |
| `cli/dist/drctl.cjs` | 배포용 CLI 번들입니다. |
| `helm/dr-agent/` | `dr-agent`를 Kubernetes에 설치하기 위한 Helm chart입니다. |
| `helm/dr-agent/templates/` | Deployment, Role, RoleBinding, Secret, ServiceAccount 템플릿입니다. |
| `docs/policy-engine.md` | Policy Engine의 입력 데이터, 점수 산식, RTO/RPO 반영 방식, UI 표시 흐름을 설명합니다. |
| `deliverables/` | 최종 보고서, 발표 자료, 예상 질의응답 등 제출 산출물을 보관합니다. |
| `scripts/` | 보고서 생성, zrok 공유, 실습 클러스터 보정에 사용하는 보조 스크립트입니다. |
| `tools/mjs/` | 루트에 있던 `.mjs` 진단/테스트 파일을 모아둔 폴더입니다. 제품 실행 경로가 아니라 점검용 유틸입니다. |
| `public/` | Vite 대시보드에서 직접 제공하는 정적 이미지입니다. |

## 실행 방법

루트에서 의존성을 설치하고 API 서버와 대시보드를 각각 실행합니다.

```bash
npm install
npm run api
npm run dev
```

기본 실행 주소는 다음과 같습니다.

| 서비스 | 주소 |
| --- | --- |
| API 서버 | `http://127.0.0.1:3001` |
| 대시보드 | Vite가 출력하는 로컬 주소 |

Docker Compose로 실행할 경우:

```bash
cp .env.api.example .env.api
docker compose up -d --build
```

`.env`, `.env.api` 등 secret 파일은 Git에 올리지 않습니다.

## 사용자 클러스터 온보딩 흐름

1. 플랫폼 API와 대시보드를 실행합니다.
2. `drctl init`으로 운영자 토큰을 발급받습니다.
3. 대시보드 다운로드 페이지에서 agent 설치 명령을 확인합니다.
4. 사용자 Kubernetes 클러스터에 `dr-agent` Helm chart를 설치합니다.
5. agent heartbeat가 들어오면 대시보드에 클러스터가 표시됩니다.
6. `drctl policy set`으로 네임스페이스별 복구 정책을 등록합니다.

예시:

```bash
drctl policy set my-cluster \
  --namespace order-service \
  --tier critical \
  --rto 1h \
  --rpo 30m
```

## Policy Engine 요약

Policy Engine은 네임스페이스별 정책과 현재 운영 상태를 비교해 복구 우선순위를 계산합니다.

입력 데이터는 다음과 같습니다.

| 입력 | 의미 |
| --- | --- |
| `tier` | 서비스 중요도 |
| `rto` | 목표 복구 시간 |
| `rpo` | 허용 가능한 백업 지연 시간 |
| Pod 상태 | Failed, Pending, Running 등 워크로드 상태 |
| 백업 최신성 | 최근 성공한 Velero backup의 나이 |
| 장애 이벤트 | Alertmanager에서 수신한 firing/resolved 이벤트 |

현재 추천 점수 산식은 다음과 같습니다.

```text
복구 추천 점수 =
  Tier 중요도 점수 * 40%
+ 백업 최신성 점수 * 40%
+ 워크로드 상태 점수 * 20%
```

자세한 설명은 `docs/policy-engine.md`를 참고하면 됩니다.

## 장애 탐지와 UI 표시

Alertmanager에서 장애 이벤트가 들어오면 서버는 `/api/events/alert`에서 이벤트를 수신해 저장합니다. 대시보드는 이벤트 상태를 읽어 클러스터나 네임스페이스를 `warning` 또는 `outage` 상태로 표시합니다.

장애 이벤트가 없으면 추천 영역은 모니터링 상태로 표시됩니다. 장애가 탐지되거나 복구 승인이 시작되면 `AI Recovery Decision` 영역에 복구 추천 목록, 점수, 설명, 승인 버튼이 표시됩니다.

## 주요 API

| Endpoint | 역할 |
| --- | --- |
| `POST /api/auth/register` | 운영자 토큰 발급 |
| `POST /api/events/alert` | Alertmanager 장애 이벤트 수신 |
| `GET /api/events/history` | 최근 장애 이벤트 조회 |
| `POST /api/agent/register` | agent 등록 |
| `POST /api/agent/heartbeat` | agent 상태 보고 |
| `GET /api/clusters` | 접근 가능한 클러스터 목록 조회 |
| `GET /api/clusters/:id/recovery-policy` | 복구 정책 조회 |
| `POST /api/clusters/:id/recovery-policy` | 복구 정책 저장 |
| `GET /api/clusters/:id/recommendations` | 복구 추천 점수 계산 |
| `POST /api/clusters/:id/recommendations/:workloadId/approve` | 추천 승인 및 복구 요청 |

## 문서 구성

현재 레포에는 중복된 작업용 md를 남기지 않고, 사람이 읽을 핵심 문서만 유지합니다.

| 파일 | 설명 |
| --- | --- |
| `README.md` | 프로젝트 전체 구조와 실행 방법 |
| `docs/policy-engine.md` | Policy Engine 상세 설명 |
| `deliverables/professor-expected-qna.md` | 발표 예상 질문과 답변 |

## 참고 사항

- `server/registry/*.json`은 데모/개발용 런타임 상태 저장소입니다.
- `recovery-policy.json`, `tokens.json`, `rto-history.json` 등 민감하거나 실행 중 변하는 파일은 `.gitignore` 대상입니다.
- `tools/mjs/`의 파일들은 운영 코드가 아니라 점검과 디버깅을 위한 유틸입니다.
- 실제 운영 환경에서는 JSON 파일 저장소 대신 DB와 Secret Manager를 사용하는 것이 적합합니다.
