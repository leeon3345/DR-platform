# cli

운영자용 `drctl` CLI 패키지입니다. 클러스터 등록, 복구 정책 설정, 추천 조회 등을 터미널에서 수행할 수 있게 합니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `bin/drctl.mjs` | CLI 원본 엔트리포인트 |
| `dist/drctl.cjs` | 배포용 CommonJS 번들 |
| `package.json` | CLI 명령, 빌드 스크립트, binary 설정 |
| `package-lock.json` | CLI 의존성 잠금 파일 |

## 주요 명령

- `drctl init`: 플랫폼 연결 정보 초기화
- `drctl policy set`: 네임스페이스별 `tier`, `RTO`, `RPO` 정책 등록
- `drctl recommend`: 복구 추천 목록 조회
