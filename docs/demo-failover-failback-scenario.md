# DR 플랫폼 Failover / Failback 데모 시나리오

이 문서는 학교 클라우드의 서비스 장애를 DR 플랫폼이 감지하고, 백업본을 이용해 중앙 복구 클러스터로 격리 복구한 뒤, 다시 원래 학교 클러스터로 되돌리는 데모 대본입니다.

> 중요: 이 시나리오는 Velero 자체를 삭제하지 않습니다. 필요한 경우 삭제하는 것은 `velero` 네임스페이스 안의 `Backup` / `Restore` 작업 기록 CR뿐입니다.

---

## 0. 데모 기준 환경

| 구분 | 값 |
| --- | --- |
| 사용자 클러스터 | `my-cluster` |
| 사용자 클러스터 Namespace | `order-service` |
| DR Platform API | `https://drplatform.share.zrok.io` |
| Dashboard Token | `usr_b7224d9e` |
| 복구 정책 | `critical`, RTO `1h`, RPO `30m` |
| 복구 대상 Namespace | `tenant-my-cluster-order-service` |

대시보드는 반드시 토큰이 포함된 URL로 엽니다.

```text
https://drplatform.share.zrok.io/dashboard?token=usr_b7224d9e
```

---

## 1. 사전 정리

데모 터미널이 `leeon@k8s-master` 또는 `ubuntu@k8s-master`이면 Kubernetes/Velero 명령만 실행합니다. DR Platform 서버의 `server/registry/clusters.json` 파일을 직접 수정하는 명령은 이 VM에서 실행하지 않습니다.

### Velero 실패 작업 기록 정리

이 명령은 학교 클러스터 VM에서 실행합니다.

실행 위치:

```text
leeon@k8s-master
```

실제 Velero 실패 작업 기록만 지우고 싶을 때는 아래처럼 특정 CR만 삭제합니다. Velero 컨트롤러나 MinIO는 삭제되지 않습니다.

```bash
kubectl -n velero delete backup.velero.io pre-chaos-1 --ignore-not-found

kubectl -n velero delete restore.velero.io \
  order-service-restore-mq97ierm \
  auth-service-restore-mq980g19 \
  calico-apiserver-restore-mq98d8zx \
  calico-system-restore-mq98etna \
  calico-system-restore-mq98jvr9 \
  dr-agent-restore-mqc860j6 \
  kube-flannel-restore-mqc88xi1 \
  --ignore-not-found
```

---

## 2. DR Agent 설치

실행 위치: 학교 클라우드 터미널, `my-cluster`

```bash
helm repo add dr-platform https://drplatform.share.zrok.io/api/download
helm repo update dr-platform

helm upgrade --install dr-agent dr-platform/dr-agent \
  --namespace dr-agent \
  --create-namespace \
  --version 0.1.13 \
  --set agent.platformUrl=https://drplatform.share.zrok.io \
  --set agent.clusterId=my-cluster \
  --set agent.token=usr_b7224d9e \
  --set image.pullPolicy=Always

kubectl rollout restart deployment/dr-agent -n dr-agent
kubectl rollout status deployment/dr-agent -n dr-agent --timeout=120s
kubectl logs -n dr-agent deploy/dr-agent --tail=50
```

정상 로그 예시:

```text
starting dr-agent for my-cluster
agent registered
heartbeat sent with 4 nodes
```

플랫폼에서 연결 상태를 확인합니다.

```bash
curl -sS -H "Authorization: Bearer usr_b7224d9e" \
  -X POST https://drplatform.share.zrok.io/api/clusters/my-cluster/validate
```

기대 결과:

```text
valid: true
agent-heartbeat: passed
node-status: 4/4 nodes Ready
```

---

## 3. 복구 정책 등록

Kubernetes namespace label만으로는 DR 플랫폼 정책 registry가 자동 갱신되지 않습니다. 데모에서는 반드시 플랫폼 정책을 먼저 등록합니다.

실행 위치: DR Platform CLI가 있는 로컬 또는 학교 클러스터 터미널

```bash
drctl policy set my-cluster \
  --namespace order-service \
  --tier critical \
  --rto 1h \
  --rpo 30m
```

CLI가 없으면 API로 등록합니다.

```bash
curl -sS -X POST https://drplatform.share.zrok.io/api/clusters/my-cluster/recovery-policy \
  -H "Authorization: Bearer usr_b7224d9e" \
  -H "Content-Type: application/json" \
  -d '{
    "policies": [{
      "namespace": "order-service",
      "tier": "critical",
      "rto": "1h",
      "rpo": "30m",
      "labels": {}
    }]
  }'
```

---

## 4. 시연용 앱 배포

Gatekeeper 정책을 피하기 위해 root가 아닌 nginx 이미지를 사용합니다.

실행 위치: 학교 클라우드 터미널, `my-cluster`

```bash
kubectl create namespace order-service --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace order-service dr-tier=critical dr-rto=1h dr-rpo=30m --overwrite
```

```bash
kubectl apply -n order-service -f - <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: order-service-web
  template:
    metadata:
      labels:
        app: order-service-web
    spec:
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: nginx
          image: nginxinc/nginx-unprivileged:1.27-alpine
          ports:
            - containerPort: 8080
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
YAML
```

정상 구동 확인:

```bash
kubectl get pods -n order-service
```

기대 결과:

```text
order-service-web-...   1/1   Running
```

---

## 5. 데모용 백업 생성

자동 백업을 기다리는 대신, 데모 직전에 명시적으로 백업을 하나 생성합니다. 그래야 Failover가 안정적으로 동작합니다.

실행 위치: 학교 클라우드 터미널, `my-cluster`

```bash
BACKUP_NAME=order-service-demo-$(date +%s)

velero backup create "${BACKUP_NAME}" \
  --include-namespaces order-service \
  --wait

velero backup get
```

기대 결과:

```text
order-service-demo-...   Completed
```

대시보드에서도 `Backups` 또는 `Backup Freshness`가 갱신됐는지 확인합니다.

---

## 6. 장애 주입

실행 위치: 학교 클라우드 터미널, `my-cluster`

서비스가 사라지는 치명적 장애를 연출합니다.

```bash
kubectl delete namespace order-service
```

즉시 대시보드 화면으로 전환합니다.

대시보드에서 장애 이벤트를 확실히 보여주기 위해 Alert 이벤트도 함께 주입합니다.

```bash
curl -sS -X POST https://drplatform.share.zrok.io/api/events/alert \
  -H "Authorization: Bearer usr_b7224d9e" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "NamespaceDeleted",
        "clusterId": "my-cluster",
        "namespace": "order-service",
        "severity": "critical"
      },
      "startsAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }]
  }'
```

멘트:

```text
사용자 클러스터에서 핵심 서비스 네임스페이스가 삭제된 상황입니다.
DR Agent와 Alert 이벤트를 통해 플랫폼이 장애를 감지하고, 정책상 critical 서비스인 order-service를 복구 후보로 올립니다.
```

---

## 7. 대시보드 감지 확인

실행 위치: 대시보드

확인할 화면:

1. `my-cluster`가 agent heartbeat 기반으로 연결되어 있는지 확인
2. 이벤트 또는 토폴로지에서 `order-service` 장애 표시 확인
3. `AI Recovery Decision` 패널에서 `order-service` 확인
4. 점수는 정책과 백업 상태 기준으로 약 `90점`, 티어는 `critical` 확인

멘트:

```text
운영자가 직접 장애 원인을 찾기 전에, DR 플랫폼이 어떤 네임스페이스가 중요하고 어떤 백업을 사용할 수 있는지 계산합니다.
order-service는 critical 정책과 최신 백업이 있기 때문에 최우선 복구 대상으로 추천됩니다.
```

---

## 8. Failover 승인

실행 위치: 대시보드

1. `AI Recovery Decision` 패널에서 `order-service` 체크
2. `선택 승인` 클릭
3. 복구 상태가 `PendingAgent`, `Submitted`, `Running`, `Completed` 흐름으로 진행되는지 확인
4. 완료 상태가 초록색 `Completed`가 될 때까지 대기

멘트:

```text
복구 승인 버튼을 누르면 플랫폼 백엔드가 Velero Restore를 생성합니다.
원본 사용자 클러스터의 order-service는 삭제됐지만, 백업본을 이용해 안전한 격리 네임스페이스로 복구됩니다.
```

---

## 9. Failover 결과 확인

실행 위치: 복구 대상 클러스터 터미널

대시보드의 실제 target이 `cloud-primary`이면 127.0.0.1:2222의 K8s 클러스터에서 확인합니다.

```bash
kubectl get all -n tenant-my-cluster-order-service
```

만약 target이 `edge-recovery`이면 Edge K3s에서 확인합니다.

```bash
sudo k3s kubectl get all -n tenant-my-cluster-order-service
```

기대 결과:

```text
deployment.apps/order-service-web
pod/order-service-web-...
```

멘트:

```text
원본 클러스터에서는 서비스가 사라졌지만, 중앙 복구 클러스터의 tenant-my-cluster-order-service 격리 공간에 서비스가 복구되었습니다.
학교별 네임스페이스를 분리해 복구하기 때문에 다른 테넌트와 충돌하지 않습니다.
```

---

## 10. Failback 준비

Failback은 중앙 복구 클러스터에서 임시로 운영하던 서비스를 다시 원래 학교 클러스터로 되돌리는 단계입니다.

Failback 전에 원래 학교 클러스터에 namespace가 비어 있거나 삭제된 상태인지 확인합니다.

실행 위치: 학교 클라우드 터미널, `my-cluster`

```bash
kubectl get namespace order-service || true
kubectl get pods -n order-service || true
```

---

## 11. Failback 실행

추천 방식은 대시보드 UI입니다.

실행 위치: 대시보드

1. `Failback Automation` 패널 이동
2. `order-service` 체크
3. `Failback` 클릭
4. 상태가 `BackupPendingAgent`, `BackupSubmitted`, `Restoring`, `Completed` 흐름으로 진행되는지 확인

멘트:

```text
중앙 복구 클러스터에서 임시로 운영하던 상태를 다시 원래 학교 클러스터로 되돌립니다.
운영자는 복잡한 Velero 명령을 직접 조합하지 않고, 대상 네임스페이스만 선택해 원상 복구를 시작할 수 있습니다.
```

---

## 12. Failback CLI 대안

UI 대신 CLI로 보여줄 경우에는 실제 존재하는 백업 이름을 먼저 확인한 뒤 사용합니다. `failback-my-cluster-latest` 같은 고정 이름은 실제 백업 이름이 아닐 수 있습니다.

실행 위치: 학교 클라우드 터미널, `my-cluster`

```bash
velero backup get
```

가장 최근의 `Completed` 백업 이름을 골라 복원합니다.

```bash
RESTORE_NAME=order-service-failback-$(date +%s)
BACKUP_NAME=<실제-Completed-백업명>

velero restore create "${RESTORE_NAME}" \
  --from-backup "${BACKUP_NAME}" \
  --include-namespaces order-service \
  --wait

velero restore get
kubectl get pods -n order-service
```

---

## 13. Failback 결과 확인

실행 위치: 학교 클라우드 터미널, `my-cluster`

```bash
kubectl get all -n order-service
```

기대 결과:

```text
deployment.apps/order-service-web
pod/order-service-web-...
```

멘트:

```text
장애 상황에서는 중앙 복구 클러스터가 서비스를 대신 받아 운영했고, 원래 학교 클러스터가 준비된 뒤에는 같은 서비스를 다시 원위치로 복원했습니다.
이 과정이 Failover와 Failback의 전체 흐름입니다.
```

---

## 14. 데모 실패 시 빠른 점검

### Agent heartbeat가 stale일 때

```bash
kubectl get deploy,pod -n dr-agent -o wide
kubectl logs -n dr-agent deploy/dr-agent --tail=80
kubectl rollout restart deployment/dr-agent -n dr-agent
```

### 추천 목록에 `order-service`가 안 보일 때

```bash
drctl policy set my-cluster \
  --namespace order-service \
  --tier critical \
  --rto 1h \
  --rpo 30m

curl -sS -H "Authorization: Bearer usr_b7224d9e" \
  https://drplatform.share.zrok.io/api/clusters/my-cluster/recommendations
```

### 백업이 없거나 오래됐을 때

```bash
velero backup create order-service-demo-$(date +%s) \
  --include-namespaces order-service \
  --wait
```

### Edge K3s 또는 MinIO가 error일 때

플랫폼 API를 `DR_SSH_PASSWORD` 포함해서 재시작합니다.

```bash
DR_SSH_PASSWORD=leeon npm run api
```

확인:

```bash
curl -sS https://drplatform.share.zrok.io/api/clusters/edge-recovery/status
curl -sS https://drplatform.share.zrok.io/api/storage/minio/status
```

---

## 15. 촬영용 최종 체크리스트

- [ ] 대시보드를 토큰 URL로 열었다.
- [ ] `my-cluster` validate 결과가 `valid: true`다.
- [ ] `order-service` 복구 정책이 플랫폼에 등록됐다.
- [ ] `order-service` Pod가 Running이다.
- [ ] `order-service` Velero backup이 `Completed`다.
- [ ] 장애 주입 후 alert 이벤트가 대시보드에 보인다.
- [ ] `AI Recovery Decision`에 `order-service`가 `critical`로 보인다.
- [ ] Failover 후 `tenant-my-cluster-order-service`에 리소스가 복구된다.
- [ ] Failback 후 원래 `order-service` 네임스페이스에 리소스가 복구된다.
