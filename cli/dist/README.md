# cli/dist

`drctl` CLI의 번들 결과물을 보관하는 폴더입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `drctl.cjs` | Node.js 환경에서 실행되는 배포용 CLI 번들 |

소스 수정은 `cli/bin/drctl.mjs`에서 하고, 이 폴더는 빌드 결과 확인용으로 사용합니다.
