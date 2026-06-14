# cli/dist

`drctl` CLI의 배포용 번들 결과물을 보관합니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `drctl.cjs` | Node.js에서 실행되는 CommonJS 번들 |

소스는 `cli/bin/drctl.mjs`이고, 이 폴더는 빌드 결과 확인과 배포 패키징 용도로만 사용합니다.
