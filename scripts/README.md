# scripts

실습 환경 준비, zrok 공유, agent 보정, 보고서 재생성에 쓰는 shell/Python 보조 스크립트입니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `zrok-share.sh` | API/대시보드 zrok 공유 URL 생성 |
| `install-k8s-main-local-path.sh` | 실습 클러스터 local-path storage 설정 |
| `patch-my-cluster-agent.sh` | 특정 agent 설정 보정 |
| `recover-agent-identities.sh` | agent identity 복구 보조 |
| `build_final_report_docx.py` | 보고서 DOCX 생성 스크립트 |
| `build_final_report_pdf.py` | 보고서 PDF 생성 스크립트 |

보고서 산출물은 레포에 보관하지 않으며, 필요할 때 로컬에서 다시 생성하는 방식으로 관리합니다.
