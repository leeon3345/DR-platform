# cli

운영자용 `drctl` CLI입니다. 플랫폼 등록, 복구 정책 설정, 복구 추천 조회를 터미널에서 수행할 수 있게 합니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `bin/drctl.mjs` | CLI 원본 구현 |
| `dist/drctl.cjs` | 배포용 번들 |
| `package.json` | CLI 빌드와 binary 설정 |
| `package-lock.json` | CLI 의존성 잠금 파일 |

## 주요 명령

| 명령 | 역할 |
| --- | --- |
| `drctl init` | 플랫폼 URL로 운영자 등록 및 토큰 저장 |
| `drctl policy set` | namespace별 `tier`, `rto`, `rpo` 정책 등록 |
| `drctl recommend` | 서버가 계산한 복구 추천 조회 |

## 정책 등록 예시

```bash
drctl policy set my-cluster \
  --namespace order-service \
  --tier critical \
  --rto 1h \
  --rpo 30m
```
