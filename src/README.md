# src

React 기반 대시보드 소스입니다. 클러스터 상태, 백업 최신성, 복구 추천, 복구 진행률, failback 흐름을 시각화합니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `App.jsx` | 대시보드 메인 UI, 상태 조합, topology/recommendation/failback 화면 |
| `api.js` | API endpoint 정의와 fetch helper |
| `DownloadPage.jsx` | agent/CLI 설치 및 온보딩 다운로드 페이지 |
| `LandingPage.jsx` | 플랫폼 소개 화면 |
| `main.jsx` | React 앱 엔트리포인트 |
| `styles.css` | Tailwind base와 React Flow 보조 스타일 |

## 화면에서 보여주는 핵심 상태

| 화면 요소 | 의미 |
| --- | --- |
| `Backup Freshness` | 최신 Velero 백업 시점과 백업 성공률 |
| `AI Recovery Decision` | Policy Engine이 계산한 복구 우선순위와 추천 설명 |
| `Cluster/Namespace Topology` | 장애 이벤트와 Pod 상태를 반영한 시각적 상태 |
| `Restore Progress` | 승인 이후 복구 진행률과 RTO 측정 |
| `Failback Automation` | 복구 클러스터에서 원래 클러스터로 돌아가는 백업/복원 흐름 |

대시보드는 장애 이벤트가 없을 때는 추천 목록을 숨기고 모니터링 상태를 보여줍니다. 장애가 탐지되거나 복구 승인이 발생하면 추천 목록과 실행 상태를 표시합니다.
