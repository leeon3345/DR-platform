# src

React 기반 대시보드 소스입니다. 사용자는 이 화면에서 클러스터 연결 상태, 백업 최신성, 장애 이벤트, 복구 추천, 복구 진행률, failback 상태를 확인합니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `App.jsx` | 대시보드의 핵심 화면과 상태 조합 로직 |
| `api.js` | API endpoint 정의와 fetch helper |
| `DownloadPage.jsx` | `drctl`과 `dr-agent` 설치 안내 페이지 |
| `LandingPage.jsx` | 플랫폼 소개 화면 |
| `main.jsx` | React 앱 진입점 |
| `styles.css` | Tailwind base와 React Flow 보조 스타일 |

## 주요 화면 로직

- API 결과를 모아 클러스터 상태, 백업 상태, 복구 준비 상태를 카드와 topology로 표시합니다.
- Alertmanager 이벤트가 firing 상태이면 namespace 또는 cluster node를 `warning`/`outage`로 표시합니다.
- 추천 API 응답을 `AI Recovery Decision` 테이블에 순위, 점수, tier, 설명, 승인 상태로 렌더링합니다.
- 운영자가 추천을 승인하면 승인 API를 호출하고, 이후 restore progress와 RTO history를 갱신합니다.

## Policy Engine 결과 표시

점수 계산은 서버에서 수행되고, 프론트엔드는 결과를 운영자가 이해하기 쉬운 형태로 보여줍니다.

| 표시 항목 | 의미 |
| --- | --- |
| 순위 | 서버가 계산한 복구 우선순위 |
| 점수 | tier, 백업 최신성, 워크로드 상태의 가중합 |
| tier | 등록된 서비스 중요도 |
| AI 설명 | 점수 산정 이유와 복구 리스크 설명 |
| 상태 | 승인됨, 복구대기, 실패, 완료 등 실행 상태 |
