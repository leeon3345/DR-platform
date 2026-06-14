# DR Platform zrok 터널링 구조

## 개요
DR Platform 발표 및 시연 환경에서는 외부에서 로컬 Mac과 K3s 내부 서비스에 원활하게 접근할 수 있도록 **zrok**을 활용하여 터널링을 구성합니다. 
zrok은 로컬과 K3s 내부에 있는 DR Platform의 핵심 구성요소를 퍼블릭 URL로 열어주어, 발표장, 모바일, 브라우저, 외부 Agent 및 Velero 등이 접근할 수 있도록 연결하는 핵심 통신 도구입니다.

발표 환경에서는 총 4개의 엔드포인트(endpoint)를 외부에 노출합니다.

- **Mac 로컬 터널링:** `3001`, `5173`, `9000` (총 3개)
- **K3s 클러스터 터널링:** `30900` NodePort (총 1개)

## 터널링 구성 요약

| 구분 | 통신 포트 | 터널 대상 | 역할 |
| --- | --- | --- | --- |
| 로컬 | `3001` | `http://localhost:3001` | DR Platform 백엔드 API 서버 |
| 로컬 | `5173` | `http://localhost:5173` | DR Platform 프론트엔드 대시보드 UI |
| 로컬 | `9000` | `http://localhost:9000` | MinIO S3 API |
| K3s | `30900` | `http://10.0.2.11:30900` | K3s MinIO 스토리지 NodePort |

---

## 포트별 상세 역할

### 1. 포트 3001 (DR Platform API)
`3001`번 포트는 DR Platform의 백엔드 API 서버를 외부로 노출합니다. 

**주요 역할**
- 클러스터 내의 모니터링 시스템(Alertmanager)이 전송하는 **장애 알람 웹훅(Webhook) 수신**
- Agent의 Heartbeat 수신 및 상태 보고 처리
- 클러스터 상태 및 장애 Topology API 제공
- AI Recovery Decision 계산 및 추천 로직 수행
- 복구 정책 저장 및 Restore/Failback 요청 처리

**주요 엔드포인트 예시**
- `POST /api/events/alert`
- `POST /api/agent/heartbeat`
- `GET /api/clusters/:id/recommendations`
- `POST /api/clusters/:id/restores`

### 2. 포트 5173 (DR Platform Dashboard)
`5173`번 포트는 React/Vite 기반으로 실행되는 프론트엔드 화면(Dashboard)을 외부에서 접속할 수 있도록 제공합니다. 즉, 발표자가 브라우저를 통해 시연을 진행하는 화면입니다.

**주요 역할**
- 클러스터의 전반적인 상태 및 장애 Topology 시각화
- 백업 데이터의 최신성 현황 표시
- AI Recovery Decision 분석 결과 표시
- 관리자(발표자)의 복구 승인 및 Failback 실행을 위한 통합 UI 제공

### 3. 포트 9000 (MinIO S3 API)
`9000`번 포트는 로컬 환경 또는 내부망과 연동된 MinIO의 표준 S3 API 통신 포트입니다.

**주요 역할**
- 백업 솔루션인 **Velero**나 클러스터 내부의 Agent가 백업 데이터를 저장하거나 읽어올 때, 프로그래밍 방식으로 통신하는 엔드포인트입니다. S3 호환 프로토콜을 사용한 데이터 통로 역할을 수행합니다.

### 4. 포트 30900 (K3s MinIO NodePort)
`30900`번 포트는 K3s 클러스터 내부에 구축된 프라이빗 MinIO 스토리지 서비스에 직접 접근하기 위해 열어둔 NodePort입니다. (zrok 공유 이름: `dr-minio`)

**주요 역할**
- 클러스터 내부에 저장된 백업 산출물이나, 장애 조치 후 생성되는 **최종 보고서(PDF/DOCX)** 파일에 직접 접근하여 다운로드할 수 있는 파일 시스템 접근 통로 역할을 수행합니다.
