# 교수 예상 질문 및 간략 대응 답변

프로젝트: DR-Platform v1  
주제: Kubernetes 다중 클러스터 재해복구(DR), Failover, Failback 자동화

## 1. 프로젝트 개요

### Q1. 이 프로젝트를 한 문장으로 설명하면 무엇인가요?

Kubernetes 서비스 장애가 발생했을 때, 백업 상태와 서비스 중요도를 바탕으로 복구 대상을 추천하고, 운영자 승인 후 Velero 기반으로 복구 클러스터에 Failover하고 다시 원래 클러스터로 Failback하는 DR 플랫폼입니다.

### Q2. 기존 Velero만 쓰면 되는데, 왜 별도 플랫폼이 필요한가요?

Velero는 백업과 복원 도구이고, 저희 플랫폼은 장애 감지, 정책 기반 우선순위 판단, 운영자 승인, 진행 상황 추적, RTO 시각화, Failback 흐름까지 묶어 운영자가 실제 장애 상황에서 의사결정하기 쉽게 만드는 상위 오케스트레이션 계층입니다.

### Q3. 이 프로젝트의 핵심 차별점은 무엇인가요?

단순 백업 자동화가 아니라 Cloud K8s와 Edge K3s를 하나의 DR 흐름으로 연결했고, Heartbeat 기반 상태 수집, 정책 기반 복구 추천, tenant namespace 격리, Failback 스크립트 발급까지 End-to-End 복구 사이클을 구현한 점입니다.

### Q4. 프로젝트에서 가장 중요한 성공 기준은 무엇인가요?

장애 발생 후 운영자가 대시보드에서 복구 대상을 확인하고 승인하면, 백업본을 이용해 복구 대상 클러스터에 서비스가 다시 올라오고, 이후 원래 클러스터로 되돌리는 Failback 흐름까지 검증되는 것입니다.

## 2. 아키텍처 및 설계 선택

### Q5. 전체 아키텍처는 어떻게 구성되어 있나요?

React 대시보드, Node.js/Express API 서버, dr-agent, Velero/MinIO, drctl CLI, Cloud K8s와 Edge K3s 클러스터로 구성했습니다. 대시보드는 상태와 복구 흐름을 보여주고, API 서버는 정책과 작업 큐를 관리하며, 에이전트는 각 클러스터 상태와 백업/복원 정보를 서버로 전달합니다.

### Q6. 왜 Polling이 아니라 Heartbeat Push 방식을 선택했나요?

학교 또는 기업의 Kubernetes 클러스터는 사설망에 있을 수 있어 중앙 플랫폼이 직접 접근하기 어렵습니다. 그래서 각 클러스터에 설치된 dr-agent가 주기적으로 중앙 서버에 상태를 Push하도록 설계해 네트워크 제약을 줄였습니다.

### Q7. dr-agent는 어떤 역할을 하나요?

클러스터 노드 상태, 워크로드 Ready 상태, Velero 백업 및 복원 이력, 명령 실행 결과를 수집해 중앙 API로 보냅니다. 또한 서버가 큐에 넣은 백업/복원 명령을 받아 실제 클러스터에서 실행하는 실행자 역할도 합니다.

### Q8. 왜 Cloud K8s와 Edge K3s 구조를 사용했나요?

Cloud K8s는 평상시 운영되는 메인 클러스터, Edge K3s는 장애 시 임시 복구 대상입니다. 실제 DR에서는 원본 환경이 완전히 복구되기 전까지 별도 환경에서 서비스를 대피 운영해야 하므로 이 구조가 Failover/Failback 흐름을 설명하기 적합합니다.

### Q9. 왜 zrok을 사용했나요?

로컬 또는 사설망에 있는 API와 대시보드를 외부에서 데모할 수 있도록 임시 공개 URL이 필요했습니다. zrok은 별도 공인 IP 없이 API와 대시보드를 안전하게 노출하는 데 적합했습니다.

### Q10. 왜 Prometheus/Alertmanager를 사용했나요?

Kubernetes 환경에서 표준적으로 많이 쓰이는 모니터링 스택이고, Alertmanager webhook을 통해 장애 이벤트를 플랫폼 API로 전달하기 쉽습니다. Zabbix보다 K8s 리소스 상태와 연동성이 높다고 판단했습니다.

## 3. 장애 감지 및 복구 추천

### Q11. 장애는 어떻게 감지하나요?

Prometheus가 클러스터 상태를 감시하고 Alertmanager가 장애 이벤트를 플랫폼 API의 alert endpoint로 전달합니다. 동시에 dr-agent heartbeat를 통해 워크로드 상태를 보완적으로 확인합니다.

### Q12. AI Recovery Decision은 실제로 무엇을 기준으로 추천하나요?

알림의 severity, namespace, 서비스 tier, RTO/RPO 정책, 백업 최신성, 워크로드 상태 등을 종합해 복구 우선순위를 계산합니다. 핵심은 AI가 복구를 바로 실행하는 것이 아니라 운영자가 판단할 수 있는 추천 근거를 제공하는 것입니다.

### Q13. AI 추천이 틀리면 어떻게 하나요?

추천은 자동 실행되지 않고 운영자 승인 단계를 반드시 거칩니다. 운영자는 대시보드에서 추천 내용을 확인하고 승인하거나 보류할 수 있으므로, 잘못된 자동 복구로 인한 피해를 줄일 수 있습니다.

### Q14. 왜 운영자 승인 단계를 넣었나요?

복구 작업은 운영 중인 클러스터의 리소스를 생성하거나 덮어쓸 수 있는 위험한 작업입니다. 특히 Failback은 원래 클러스터에 데이터를 되돌리는 작업이므로, 사람의 최종 승인을 두는 것이 안전하다고 판단했습니다.

### Q15. RTO와 RPO는 어떻게 반영했나요?

RTO는 장애 감지부터 복구 완료까지 걸리는 시간을 추적하는 기준으로 사용했고, RPO는 최신 백업 완료 시각과 정책 값을 비교해 백업이 너무 오래됐는지 판단하는 데 사용했습니다.

## 4. 백업, 복원, Failover

### Q16. 실제 복구는 어떤 도구로 수행하나요?

Velero를 사용합니다. Velero는 Kubernetes namespace 단위의 리소스를 백업하고, 필요 시 지정한 클러스터에 restore를 생성해 리소스를 복원합니다.

### Q17. 왜 MinIO를 사용했나요?

MinIO는 S3 호환 오브젝트 스토리지라 Velero의 BackupStorageLocation으로 사용하기 쉽고, 로컬 또는 데모 환경에서 외부 클라우드 계정 없이 백업 저장소를 구성할 수 있습니다.

### Q18. Failover 흐름을 설명해보세요.

원본 Cloud K8s에서 `order-service` 같은 critical namespace 장애가 발생하면 플랫폼이 alert를 수신합니다. 대시보드는 복구 후보를 추천하고, 운영자가 승인하면 Velero restore가 실행되어 복구 클러스터의 tenant namespace에 서비스가 올라옵니다.

### Q19. 복구 대상 namespace를 왜 `tenant-my-cluster-order-service`처럼 바꾸나요?

공유 복구 클러스터에서 여러 사용자가 같은 `order-service` namespace를 복구하면 충돌이 납니다. 그래서 원본 클러스터 ID를 포함한 tenant namespace로 mapping해 사용자 간 리소스 충돌을 방지했습니다.

### Q20. 복구가 완료됐다는 기준은 무엇인가요?

Velero restore phase가 `Completed`가 되고, 복구된 namespace의 pod가 `Running` 또는 Ready 상태로 보고되며, 대시보드의 restore progress가 완료 상태로 전환되는 것을 기준으로 봅니다.

## 5. Failback

### Q21. Failback은 무엇인가요?

Failover로 임시 복구 클러스터에서 운영하던 서비스를 원래 Cloud K8s 클러스터로 되돌리는 과정입니다. 즉, 장애 대피 후 원상 복구 단계입니다.

### Q22. Failback은 완전 자동인가요?

완전 자동으로 원본 클러스터에 바로 복원하지 않고, 보안과 권한 격리를 위해 복구 스크립트를 발급하거나 운영자 승인 흐름을 거치도록 했습니다. 원본 클러스터에 데이터를 덮어쓰는 작업은 위험도가 크기 때문입니다.

### Q23. 왜 완전 자동 Failback을 보류했나요?

원래 클러스터는 운영 데이터가 있는 메인망이고, 플랫폼이 임의로 restore를 실행하면 데이터 덮어쓰기나 권한 오남용 위험이 있습니다. 그래서 현재 버전에서는 자동화 편의성과 운영 안전성 사이에서 스크립트 발급 방식을 선택했습니다.

### Q24. Failback 시 최신 데이터는 어떻게 보존하나요?

복구 클러스터에서 임시 운영 중 생긴 최신 상태를 먼저 Velero backup으로 저장한 뒤, 그 백업을 원래 클러스터에서 restore하도록 설계했습니다.

## 6. 보안 및 멀티테넌시

### Q25. 사용자별 데이터 격리는 어떻게 하나요?

API와 대시보드는 token 기반으로 접근 가능한 clusterId를 제한합니다. 복구 클러스터에서는 tenant namespace naming을 적용하고, 백업 저장소에서는 Velero prefix를 사용해 클러스터별 백업 경로를 분리하는 방향으로 설계했습니다.

### Q26. MinIO 하나를 공유하면 보안상 문제가 없나요?

현재는 prefix 기반 논리 격리를 적용하는 수준입니다. 데모와 MVP에는 적합하지만, 운영 환경에서는 사용자별 bucket 또는 prefix 제한 credential을 별도로 발급해 강한 보안 경계를 만들어야 합니다.

### Q27. 토큰이나 API key는 어디에 저장하나요?

대시보드 토큰과 agent token은 설치 과정에서 전달하고, LLM API key 같은 서버 비밀값은 `.env.api`처럼 Git에 커밋되지 않는 서버 환경 파일에 저장합니다. 브라우저 코드에는 secret을 넣지 않습니다.

### Q28. 브라우저에서 직접 kubectl이나 SSH 명령을 실행하나요?

아닙니다. 브라우저는 API를 호출하고 상태를 표시할 뿐입니다. Kubernetes, SSH, Velero 같은 민감한 작업은 백엔드나 클러스터 내부 agent가 수행하도록 분리했습니다.

## 7. 구현 및 기술 선택

### Q29. 프론트엔드는 어떤 역할을 하나요?

React 대시보드는 cluster health, topology, incident stream, AI recovery decision, restore progress, failback automation을 보여주고, 운영자가 복구 승인과 Failback 실행을 할 수 있는 UI를 제공합니다.

### Q30. 백엔드는 어떤 역할을 하나요?

Node.js/Express 서버는 alert 수신, agent heartbeat 수신, cluster registry 관리, recovery policy 관리, backup/restore command queue, RTO history, download endpoint를 담당합니다.

### Q31. drctl CLI는 왜 만들었나요?

사용자가 터미널에서 플랫폼 등록과 복구 정책 설정을 쉽게 하도록 만들었습니다. 예를 들어 `drctl init`으로 토큰을 발급받고, `drctl policy set`으로 namespace별 tier, RTO, RPO를 선언할 수 있습니다.

### Q32. 로컬 JSON 파일을 registry로 쓴 이유는 무엇인가요?

MVP와 데모에서는 설치와 검증을 단순화하기 위해 파일 기반 registry를 사용했습니다. 다만 동시 쓰기나 확장성 한계가 있어 운영 환경에서는 Postgres 같은 DB로 전환하는 것이 적절합니다.

### Q33. 동시 승인 시 문제가 생길 수 있나요?

초기에는 병렬 승인 요청이 로컬 JSON registry 동시 쓰기 충돌을 일으킬 수 있었습니다. 그래서 프론트엔드에서 승인 API를 순차적으로 호출하도록 개선했고, 향후에는 DB 트랜잭션으로 해결하는 것이 맞습니다.

## 8. 검증 및 데모

### Q34. 데모 시나리오는 어떻게 진행하나요?

정상 상태 확인, Velero 백업 생성, `order-service` namespace 장애 주입, Alertmanager 이벤트 수신, AI 추천 확인, 운영자 승인, 복구 클러스터 restore 확인, Failback 실행 순서로 진행합니다.

### Q35. 장애 주입은 어떤 방식으로 하나요?

데모에서는 `kubectl delete namespace order-service`로 critical service namespace가 사라지는 상황을 시뮬레이션합니다. 이때 사전에 fresh backup을 만들어 복구가 안정적으로 되도록 합니다.

### Q36. 실제 End-to-End 검증에서 무엇을 확인했나요?

Cloud K8s 장애 발생, 복구 클러스터 대피, K3s 임시 운영, 최신 데이터 백업, 원래 K8s로 복구하는 흐름을 검증 대상으로 삼았습니다. 대시보드에서는 restore progress와 RTO timeline을 통해 진행 상태를 확인했습니다.

### Q37. 복구 시간이 목표보다 길어지면 어떻게 판단하나요?

RTO target과 actual RTO를 비교해 SLA 위반 여부를 판단합니다. 원인은 alert detection 지연, 백업 freshness 문제, image pull 지연, Velero restore 오류 등으로 나눠 추적할 수 있습니다.

### Q38. 데모가 실패하면 어떻게 대응하나요?

먼저 API와 dashboard 연결, agent heartbeat, Alertmanager webhook, Velero backup phase, restore phase를 순서대로 확인합니다. 발표에서는 실패 자체보다 어느 단계에서 막혔는지 관측 가능하게 만든 점을 설명할 수 있습니다.

## 9. 한계 및 향후 개선

### Q39. 현재 프로젝트의 가장 큰 한계는 무엇인가요?

운영 수준의 강한 멀티테넌시와 완전 자동 Failback은 아직 제한적입니다. 특히 공유 MinIO 환경은 prefix 기반 논리 격리이므로 실제 서비스화하려면 사용자별 bucket/credential과 DB 기반 상태 관리가 필요합니다.

### Q40. 향후 가장 먼저 개선하고 싶은 부분은 무엇인가요?

첫째, JSON registry를 Postgres 같은 DB로 전환해 동시성과 감사 로그를 강화하고 싶습니다. 둘째, MinIO bucket/credential 자동 프로비저닝을 구현해 tenant isolation을 강화하고 싶습니다. 셋째, GitOps 기반 Failback으로 안전한 자동화를 고도화하고 싶습니다.

### Q41. GitOps를 붙이면 무엇이 좋아지나요?

원본 클러스터에 직접 명령을 실행하는 대신 Git에 복구 의도를 선언하고 ArgoCD 같은 도구가 적용하게 만들 수 있습니다. 이렇게 하면 감사 추적, 승인 절차, 롤백 관리가 쉬워집니다.

### Q42. 운영 환경에 적용하려면 무엇이 더 필요하나요?

RBAC 세분화, 사용자별 스토리지 credential, DB 트랜잭션, audit log, TLS와 secret rotation, restore dry-run, multi-region object storage, 알림 채널 연동, 부하 테스트가 필요합니다.

## 10. 답변할 때 강조할 핵심 문장

- "Velero는 백업/복원 도구이고, DR-Platform은 장애 감지부터 추천, 승인, 복구 추적, Failback까지 묶은 운영 플랫폼입니다."
- "AI는 복구를 자동 실행하지 않고, 운영자 결정을 돕는 추천 계층으로 사용했습니다."
- "Heartbeat Push는 사설망 클러스터에 중앙 서버가 직접 접근하기 어려운 현실적인 네트워크 제약을 해결하기 위한 선택입니다."
- "Failback을 완전 자동으로 하지 않은 것은 미완성이 아니라, 메인 클러스터 데이터 덮어쓰기 위험을 고려한 안전 설계입니다."
- "현재 MVP는 prefix 기반 논리 격리이고, 운영 환경에서는 사용자별 bucket/credential과 DB 기반 registry로 고도화해야 합니다."
- "핵심 검증 포인트는 장애 발생, 복구 클러스터 대피, 임시 운영, 최신 데이터 백업, 원래 클러스터 복귀까지의 End-to-End DR 흐름입니다."
