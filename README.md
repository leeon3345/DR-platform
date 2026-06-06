# DR-platform

클라우드-엣지 지능형 DR 플랫폼입니다. 기존 `k8s-compliance-platform`의 관제형 UI 스타일을 React로 옮긴 단일 재난 복구 대시보드를 제공합니다.

화면은 다음 세 가지 운영 흐름에만 집중합니다.

1. Zabbix 장애 상태 표출
2. AI 복구 우선순위 추천
3. 선택 서비스의 복구 실행

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`로 생성합니다.

## CLI 오케스트레이터 연결 지점

현재 복구 실행 버튼은 UI 검증을 위한 데모 로그를 생성합니다. 실제 연동 시 복구 실행 함수에서 아래와 같은 얇은 API를 호출하고, API 서버가 CLI를 실행하도록 구성합니다.

```http
POST /api/restores
Content-Type: application/json

{
  "backup": "full-prod-20260606-0200",
  "targetCluster": "edge-k3s",
  "services": ["auth-service", "payment-api", "api-gateway"]
}
```

백엔드에서는 API 요청을 검증한 뒤 `drctl`, `velero`, `kubectl`, `k3s` 등의 CLI만 호출하는 구조를 권장합니다. 브라우저가 직접 쉘 명령을 실행하지 않도록 분리합니다.
