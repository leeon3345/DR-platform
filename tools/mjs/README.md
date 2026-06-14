# tools/mjs

Node.js 기반 실험/진단 스크립트 모음입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `test-api.mjs` | API 호출 테스트 |
| `scratch_metrics.mjs` | metric 수집 실험 |
| `scratch_kubeconfig.mjs` | cloud-primary kubeconfig 추출 보조 |
| `scratch_test.mjs` | 임시 API/로직 테스트 |
| `scratch_systemd.mjs` | systemd 관련 실험 |
| `scratch_ssh.mjs` | SSH 연결 실험 |

루트에서 분리해 제품 코드와 진단 코드를 구분했습니다. 경로 의존성이 있는 스크립트는 루트에서 실행하는 것을 기준으로 작성되어 있습니다.
