# zrok 외부 노출 구조 Q&A

DR Platform 발표에서 zrok 터널링 구조를 설명하기 위한 문서입니다.

## 전체 요약

발표 환경에서는 총 4개의 endpoint를 zrok으로 외부에 노출합니다.

```text
API용 3001
화면용 5173
백업 통신용 9000
파일/스토리지 접근용 30900
```

즉, Mac 로컬에서 3개 포트(`3001`, `5173`, `9000`)를 열고, K3s 클러스터 쪽에서 1개 NodePort(`30900`)를 엽니다.

## 터널링 구성

| 구분 | 포트 | 터널 대상 | 역할 |
| --- | ---: | --- | --- |
| 로컬 | `3001` | `http://localhost:3001` | DR Platform API 서버 |
| 로컬 | `5173` | `http://localhost:5173` | DR Platform 대시보드 UI |
| 로컬 | `9000` | `http://localhost:9000` 또는 해당 IP의 `9000` | MinIO S3 API |
| K3s | `30900` | `http://10.0.2.11:30900` | K3s MinIO NodePort, endpoint 이름 `dr-minio` |

## Q1. zrok은 왜 사용했나요?

**답변**

로컬 Mac과 K3s 내부 서비스는 외부에서 직접 접근하기 어렵기 때문에 zrok으로 public URL을 만들어 연결했습니다. 발표장, 모바일, 외부 브라우저, agent, Velero가 모두 접근할 수 있도록 API, 화면, 백업 스토리지 endpoint를 터널링했습니다.

**짧게 말하면**

zrok은 로컬과 K3s 내부에 있는 DR Platform 구성요소를 외부에서 접근 가능한 URL로 열어주는 터널링 도구입니다.

## Q2. zrok으로 몇 개를 열었나요?

**답변**

총 4개입니다.

- 로컬 Mac 터미널에서 3개: `3001`, `5173`, `9000`
- K3s 클러스터에서 1개: `30900`

**발표용 한 문장**

API용 `3001`, 화면용 `5173`, 백업 통신용 `9000`, 파일/스토리지 접근용 `30900` 이렇게 4가지를 zrok으로 터널링했습니다.

## Q3. 포트 3001은 무엇인가요?

**답변**

`3001`은 DR Platform API 서버 포트입니다. 클러스터 Alertmanager가 보내는 장애 알람 webhook을 수신하고, 대시보드와 agent가 데이터를 주고받는 백엔드 통로입니다.

**역할**

- Alertmanager webhook 수신
- agent heartbeat 수신
- 클러스터 상태 API 제공
- recovery policy 저장
- recommendation 계산
- restore/failback 요청 처리

**예시 endpoint**

```text
POST /api/events/alert
POST /api/agent/heartbeat
GET /api/clusters/:id/recommendations
POST /api/clusters/:id/restores
```

## Q4. 포트 5173은 무엇인가요?

**답변**

`5173`은 DR Platform 대시보드 포트입니다. React/Vite로 실행되는 프론트엔드 화면을 외부에서 볼 수 있도록 zrok으로 열었습니다.

**역할**

- 클러스터 상태 시각화
- 장애 topology 표시
- 백업 최신성 표시
- AI Recovery Decision 표시
- 복구 승인 및 failback 실행 UI 제공

**짧게 말하면**

`5173`은 발표자가 브라우저로 보는 DR Platform 화면입니다.

## Q5. 포트 9000은 무엇인가요?

**답변**

`9000`은 MinIO의 표준 S3 API 포트입니다. Velero나 agent가 백업 데이터를 저장하거나 읽을 때 프로그래밍 방식으로 통신하는 endpoint입니다.

**역할**

- Velero backup 데이터 저장
- Velero restore 시 백업 데이터 조회
- MinIO S3 호환 API 제공

**짧게 말하면**

`9000`은 사람이 보는 화면이 아니라 Velero와 프로그램이 백업 데이터를 주고받는 S3 API 통신 포트입니다.

## Q6. 포트 30900은 무엇인가요?

**답변**

`30900`은 K3s 클러스터 안의 MinIO 서비스를 외부에서 접근하기 위해 연 NodePort입니다. 내부 endpoint는 `http://10.0.2.11:30900`이고, zrok endpoint 이름은 `dr-minio`로 설명할 수 있습니다.

**역할**

- K3s 내부 MinIO 서비스에 외부에서 직접 접근
- 대시보드에서 백업 파일 또는 보고서 파일 다운로드 시 접근 통로
- 클러스터 안에 격리된 스토리지 endpoint를 외부에서 사용할 수 있게 함

**짧게 말하면**

`30900`은 K3s 내부 MinIO로 들어가는 외부 접근용 NodePort입니다.

## Q7. 9000과 30900은 둘 다 MinIO인데 차이가 뭔가요?

**답변**

둘 다 MinIO 접근과 관련 있지만 위치와 목적이 다릅니다.

| 포트 | 위치 | 의미 |
| ---: | --- | --- |
| `9000` | 로컬 또는 MinIO 직접 endpoint | MinIO S3 API 표준 포트 |
| `30900` | K3s NodePort | K3s 내부 MinIO를 외부에 노출한 접근 포트 |

**발표 답변**

`9000`은 MinIO 자체의 S3 API 포트이고, `30900`은 K3s 안에 있는 MinIO를 외부에서 접근하기 위해 Kubernetes NodePort로 열어둔 포트입니다.

## Q8. agent는 zrok URL을 어떻게 사용하나요?

**답변**

agent 설치 시 `agent.platformUrl`에 API zrok URL을 넣습니다. 그러면 K3s 또는 사용자 클러스터 안의 agent가 외부 URL을 통해 `3001` API 서버로 heartbeat와 상태 정보를 보냅니다.

**예시**

```bash
helm upgrade --install dr-agent dr-platform/dr-agent \
  --set agent.platformUrl=https://drplatform.share.zrok.io \
  --set agent.clusterId=my-cluster \
  --set agent.token=<TOKEN>
```

**핵심**

agent는 Mac의 localhost에 직접 접근하는 것이 아니라, zrok이 열어준 public API URL로 서버와 통신합니다.

## Q9. Alertmanager webhook은 zrok을 어떻게 사용하나요?

**답변**

Alertmanager는 DR Platform API 서버의 zrok URL로 webhook을 보냅니다.

```text
POST https://<api-zrok-url>/api/events/alert
```

API 서버는 이 alert를 받아 장애 이벤트로 저장하고, 대시보드는 이를 기반으로 warning/outage 상태와 복구 추천 흐름을 표시합니다.

## Q10. Velero는 zrok을 어떻게 사용하나요?

**답변**

Velero는 backup storage location의 S3 endpoint로 MinIO zrok URL을 사용합니다.

예를 들어 MinIO가 zrok으로 공개되어 있으면 Velero 설정에 다음처럼 들어갑니다.

```text
s3Url=https://dr-minio.shares.zrok.io
```

**핵심**

Velero 입장에서는 MinIO가 S3 호환 스토리지이고, zrok은 그 스토리지를 외부에서 접근 가능한 URL로 만들어주는 역할입니다.

## Q11. zrok이 꺼지면 어떻게 되나요?

**답변**

해당 터널에 의존하는 기능이 외부에서 접근 불가능해집니다.

| 꺼진 터널 | 영향 |
| --- | --- |
| `3001` API | webhook, agent heartbeat, dashboard API 호출 실패 |
| `5173` Dashboard | 외부 브라우저에서 대시보드 접속 불가 |
| `9000` MinIO S3 API | Velero/agent의 백업 데이터 통신 실패 가능 |
| `30900` K3s MinIO NodePort | K3s 내부 MinIO 직접 접근, 파일 다운로드 통로 실패 가능 |

## Q12. 임시 URL과 reserved URL 차이는 무엇인가요?

**답변**

임시 public share는 실행할 때마다 URL이 바뀔 수 있습니다. reserved share는 같은 이름이나 token으로 안정적인 URL을 유지할 수 있습니다.

**발표 답변**

데모에서는 URL이 바뀌면 agent 설정, Alertmanager webhook URL, Velero storage URL을 다시 바꿔야 하기 때문에 reserved zrok URL을 쓰는 것이 안정적입니다.

## 발표용 최종 요약

**짧은 버전**

API용 `3001`, 화면용 `5173`, 백업 통신용 `9000`, 파일 다운로드와 K3s MinIO 접근용 `30900` 이렇게 4개 endpoint를 zrok으로 터널링해서 외부와 연동했습니다.

**조금 긴 버전**

DR Platform API 서버는 `3001`, 대시보드는 `5173`에서 로컬로 실행하고 zrok으로 외부에 공개했습니다. 백업 저장소인 MinIO는 S3 API 통신용 `9000`을 사용하고, K3s 내부 MinIO는 NodePort `30900`으로 열어 `dr-minio` endpoint를 통해 접근했습니다. 이 구조 덕분에 외부 브라우저, Alertmanager, agent, Velero가 각각 필요한 endpoint에 접근할 수 있습니다.

## 발표 전 체크리스트

- [ ] `3001` API zrok URL 확인
- [ ] `5173` Dashboard zrok URL 확인
- [ ] `9000` MinIO S3 API zrok URL 확인
- [ ] `30900` K3s MinIO NodePort zrok URL 확인
- [ ] Alertmanager webhook URL이 API zrok URL인지 확인
- [ ] agent `platformUrl`이 API zrok URL인지 확인
- [ ] Velero `s3Url`이 MinIO zrok URL인지 확인
- [ ] 임시 URL이면 발표 직전 URL 변경 여부 확인

