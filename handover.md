# DR Platform 인수인계 문서 (최근 작업 내역)

## 1. 프로젝트 개요
* **DR Platform**: Kubernetes 환경(Cloud K8s ↔ Edge K3s) 간의 재해 복구(Disaster Recovery)를 위한 대시보드 및 백엔드 API 서버.
* **주요 기능**: Prometheus 알람(장애 감지) 수신, AI 기반 복구 추천, 사용자 승인(운영자 개입), Velero를 통한 타겟 클러스터(Edge) 복구, RTO(복구 시간 목표) 타임라인 측정.

## 2. 최근 작업 완료 사항 (Troubleshooting 내역)

### 2.1 대시보드 복구 일괄 승인(Bulk Approval) 기능 추가
* **작업 파일**: `src/App.jsx`
* **내용**: 기존에 하나의 추천 항목만 승인할 수 있던 UI를 개선하여, 여러 개의 복구 추천을 체크박스로 선택하고 **[선택 승인]** 버튼을 통해 한 번에 일괄 승인할 수 있도록 로직을 구현했습니다.
* **버그 픽스 (흰 화면 문제)**: 상태 변수(`pendingWorkloadId`)를 리팩토링하는 과정에서 발생했던 참조 오류(Reference Error)를 수정하여 렌더링 충돌 현상을 해결했습니다.

### 2.2 RTO(목표 복구 시간) 타임라인 측정 버그 수정
* **작업 파일**: `server/server.mjs`
* **문제 원인**: 백엔드의 `resolveRtoSourceClusterId` 함수가 하드코딩된 시스템 클러스터(`cloud-primary`)만 반환하도록 설정되어 있어, 실제 사용자 클러스터(`my-cluster`)에서 발생한 장애와 복구 내역이 서로 다른 ID로 파편화되어 타임라인에 그려지지 않았습니다.
* **해결**: 사용자 클러스터 ID를 그대로 보존하여 반환하도록 로직을 수정, 장애 감지부터 복구 완료까지 전체 라이프사이클이 하나의 타임라인에 정상적으로 렌더링되게 만들었습니다.

### 2.3 토폴로지 애니메이션(Cloud K8s 노드 빨간색 표시) 매핑 로직 확장
* **작업 파일**: `src/App.jsx` (`getAlertTargetNodes` 함수)
* **문제 원인**: 알람 대상을 토폴로지 맵에 매핑할 때, 과거 데모 환경 네임스페이스(`order-service`)만 감지하게 하드코딩 되어 있어 사용자 환경에서 장애를 주입해도 노드 색상이 변하지 않았습니다.
* **해결**: 사용자 지정 클러스터(`my-cluster`)와 네임스페이스(`analytics` 등)도 조건문에 추가하여, 장애 발생 시 정확히 Cloud K8s 노드가 `Outage(빨간색)`로 변하도록 반영했습니다.

### 2.4 백엔드 JSON DB 동시성(Race Condition) 오류 및 JSON 파일 파손 복구
* **작업 파일**: `src/App.jsx` (`handleApproveRecommendation` 함수), `server/registry/recovery-policy.json`
* **문제 원인**: 일괄 승인을 위해 프론트엔드에서 `Promise.all`로 N개의 승인 API를 동시에 호출했으나, 백엔드가 로컬 JSON 파일을 DB로 사용하는 구조여서 동시 쓰기(Concurrent Writes) 충돌이 발생해 `recovery-policy.json` 파일이 깨졌습니다(Invalid JSON).
* **해결**: 
  1. 깨진 `server/registry/recovery-policy.json` 파일을 수동 편집으로 복구했습니다.
  2. 프론트엔드에서 승인 API를 병렬(`Promise.all`)이 아닌 순차적(`for...of`)으로 호출하도록 개선해 파일 충돌을 완벽히 방지했습니다.

## 3. 테스트 및 실행 방법

### 서버 재시작 가이드
위 프론트엔드/백엔드 코드가 변경될 때마다 아래 명령어로 빌드 및 재시작이 진행되었습니다. 만약 다음 대화창에서 컨테이너가 내려가 있다면 실행해 주시면 됩니다.
```bash
docker-compose build dr-api dr-dashboard
docker-compose up -d
```

### 장애 감지(웹훅) 테스트 가이드
K8s 환경 조작 없이 대시보드 UI를 즉각적으로 테스트하려면 터미널에서 다음 `curl` 명령어를 사용하세요.
```bash
curl -X POST http://localhost:3001/api/events/alert \
  -H "Content-Type: application/json" \
  -d '{
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "NamespaceDown",
          "severity": "critical",
          "namespace": "analytics",
          "clusterId": "my-cluster"
        },
        "annotations": {
          "summary": "Namespace analytics is down in my-cluster"
        }
      }
    ]
  }'
```
이후 대시보드에서 `analytics` 추천 목록을 전체 선택하여 승인하면, **RTO 타임라인** 기능이 완벽하게 작동하는 것을 확인할 수 있습니다.

## 4. 알려진 이슈 및 참고 사항
* 백엔드의 DB 구조가 단일 JSON 파일을 읽고 쓰는 방식입니다. 파일 쓰기 중 충돌을 막기 위해 프론트엔드에서 다중 작업 시 가급적 순차적(`for..of` 등)으로 API를 호출해야 합니다.
* 실제 환경 테스트 시, Prometheus가 `status: "resolved"` 웹훅을 보내기 전까지 대시보드의 토폴로지 노드는 계속 빨간색(Outage)으로 표시됩니다. 이는 클라우드 원본 사이트의 장애 상태를 운영자에게 알리는 의도된 DR 동작입니다.
