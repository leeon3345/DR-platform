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
├── agent/                       # 사용자 클러스터에서 실행되는 dr-agent
├── cli/                         # 운영자용 drctl CLI
├── helm/                        # dr-agent 배포용 Helm chart
├── docs/                        # 핵심 설명 문서
├── deploy/                      # Dockerfile, Docker Compose 배포 구성
├── config/                      # 환경 변수 예시와 kubeconfig 참고 파일
├── scripts/                     # 배포/보고서/실습 보조 스크립트
├── tools/                       # 진단, 유지보수, 실험용 유틸
├── public/                      # 대시보드 정적 이미지
├── package.json                 # 루트 앱 실행 스크립트와 프론트엔드 의존성
├── vite.config.js               # Vite 개발 서버와 빌드 설정
├── tailwind.config.js           # Tailwind CSS 설정
├── postcss.config.js            # PostCSS 설정
└── README.md                    # 프로젝트 전체 설명
```

## 루트에 남긴 파일

루트에는 프론트엔드 빌드 도구와 npm이 기본적으로 찾는 파일만 남겼습니다.

| 파일 | 역할 |
| --- | --- |
| `package.json` | 대시보드와 API 실행 스크립트 정의 |
| `package-lock.json` | 루트 의존성 잠금 파일 |
| `index.html` | Vite 앱 진입 HTML |
| `vite.config.js` | Vite 설정 |
| `tailwind.config.js` | Tailwind CSS 스캔 대상과 테마 설정 |
| `postcss.config.js` | Tailwind/PostCSS 연결 설정 |
| `LICENSE` | 라이선스 |
| `README.md` | 프로젝트 구조와 실행 방법 |

## 실행 방법

로컬 개발 모드:

```bash
npm install
npm run api
npm run dev
```

Docker Compose 실행:

```bash
cp config/env.api.example .env.api
docker compose -f deploy/docker-compose.yml up -d --build
```

기본 주소:

| 서비스 | 주소 |
| --- | --- |
| API 서버 | `http://127.0.0.1:3001` |
| 대시보드 | Vite 개발 서버 주소 또는 Docker Compose 기준 `http://127.0.0.1:5173` |

`.env`, `.env.api` 등 secret 파일은 Git에 올리지 않습니다.

## 장애 복구 흐름

1. 운영자가 `drctl init`으로 플랫폼 토큰을 발급받습니다.
2. 사용자 클러스터에 `dr-agent` Helm chart를 설치합니다.
3. agent가 Pod 상태, 백업 상태, 복구 상태를 API 서버로 보고합니다.
4. 운영자가 `drctl policy set`으로 네임스페이스별 복구 정책을 등록합니다.
5. Alertmanager가 장애 이벤트를 `/api/events/alert`로 전송합니다.
6. Policy Engine이 정책, 백업 최신성, 워크로드 상태를 조합해 복구 우선순위를 계산합니다.
7. 대시보드의 `AI Recovery Decision`에서 추천 점수와 설명을 확인하고 복구를 승인합니다.

정책 등록 예시:

```bash
drctl policy set my-cluster \
  --namespace order-service \
  --tier critical \
  --rto 1h \
  --rpo 30m
```

## Policy Engine 요약

Policy Engine은 네임스페이스별 정책과 현재 운영 상태를 비교해 복구 우선순위를 계산합니다.

```text
복구 추천 점수 =
  Tier 중요도 점수 * 40%
+ 백업 최신성 점수 * 40%
+ 워크로드 상태 점수 * 20%
```

입력 데이터:

| 입력 | 의미 |
| --- | --- |
| `tier` | 서비스 중요도 |
| `rto` | 목표 복구 시간 |
| `rpo` | 허용 가능한 백업 지연 시간 |
| Pod 상태 | Failed, Pending, Running 등 워크로드 상태 |
| 백업 최신성 | 최근 성공한 Velero backup의 나이 |
| 장애 이벤트 | Alertmanager에서 수신한 firing/resolved 이벤트 |

자세한 산식과 UI 반영 방식은 `docs/policy-engine.md`에 정리되어 있습니다.

## 폴더별 문서

각 주요 폴더에는 한국어 `README.md`를 두어 구조와 역할을 바로 확인할 수 있게 했습니다.

| 문서 | 설명 |
| --- | --- |
| `src/README.md` | 대시보드 화면 구성과 상태 표시 로직 |
| `server/README.md` | API 서버, Policy Engine, 주요 endpoint 설명 |
| `agent/README.md` | agent heartbeat, 명령 처리, Velero 연동 설명 |
| `cli/README.md` | `drctl` 명령과 정책 등록 흐름 |
| `helm/README.md` | agent Helm chart 구조 |
| `deploy/README.md` | Dockerfile과 Compose 실행 방식 |
| `config/README.md` | 환경 파일과 kubeconfig 관리 방식 |
| `scripts/README.md` | 배포/보고서/실습 보조 스크립트 |
| `tools/README.md` | 진단/유지보수/실험 유틸 정리 |
| `docs/policy-engine.md` | Policy Engine 상세 로직 |

## 정리 기준

- 제출 산출물 폴더였던 `deliverables/`는 레포에서 제거했습니다.
- 루트의 Docker, kubeconfig, 진단 스크립트, 임시 수정 스크립트는 성격별 폴더로 이동했습니다.
- 루트에는 npm/Vite가 기대하는 설정 파일과 프로젝트 설명 파일만 남겼습니다.
- 생성 산출물은 다시 올라오지 않도록 `.gitignore`에 `deliverables/`를 추가했습니다.
