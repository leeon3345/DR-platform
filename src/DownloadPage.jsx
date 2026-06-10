import { Link } from "react-router-dom";

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL || "https://your-platform.zrok.io";

const STEPS = [
  {
    number: 1,
    title: "DR Platform 등록",
    description: "drctl CLI로 플랫폼에 조직을 등록하고 토큰을 발급받습니다.",
    code: `drctl init \\
  --platform ${PLATFORM_URL} \\
  --name <your-org>`,
    note: "토큰이 발급되고 대시보드 URL이 제공됩니다.",
    accent: "sky",
  },
  {
    number: 2,
    title: "사용자 클러스터에 Velero 설치",
    description: "Velero를 설치하여 클러스터 백업을 MinIO 스토리지에 저장합니다.",
    code: `velero install \\
  --provider aws \\
  --bucket velero-backups \\
  --secret-file ./credentials-velero \\
  --backup-location-config \\
    s3Url=http://<minio-endpoint>:30900,\\
    region=minio,s3ForcePathStyle=true \\
  --use-volume-snapshots=false \\
  --plugins velero/velero-plugin-for-aws:v1.10.0`,
    note: "MinIO endpoint는 플랫폼 관리자에게 확인하세요.",
    accent: "emerald",
  },
  {
    number: 3,
    title: "dr-agent 설치 (Helm)",
    description: "Helm으로 dr-agent를 설치하여 클러스터 상태를 자동으로 전송합니다.",
    code: `helm install dr-agent \\
  oci://ghcr.io/dr-platform/dr-agent \\
  --set agent.platformUrl=${PLATFORM_URL} \\
  --set agent.clusterId=my-cluster \\
  --set agent.token=<your-token>`,
    note: "토큰은 Step 1에서 발급받은 값을 사용합니다.",
    accent: "violet",
  },
  {
    number: 4,
    title: "복구 정책 정의",
    description: "네임스페이스별 복구 우선순위와 RTO/RPO를 설정합니다.",
    code: `drctl policy set my-cluster \\
  --namespace order-service \\
  --tier critical \\
  --rto 1h \\
  --rpo 30m`,
    note: "critical, standard, low 세 가지 티어를 지원합니다.",
    accent: "amber",
  },
  {
    number: 5,
    title: "대시보드 접속",
    description: "발급받은 토큰으로 대시보드에 접속하여 클러스터를 모니터링합니다.",
    code: `${PLATFORM_URL}/dashboard?token=<your-token>`,
    note: "토큰이 포함된 URL을 브라우저에 입력하세요.",
    accent: "sky",
  },
];

const accentColors = {
  sky: {
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    border: "border-sky-500/20",
    line: "bg-sky-500",
    dot: "border-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.4)]",
  },
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    border: "border-emerald-500/20",
    line: "bg-emerald-500",
    dot: "border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.4)]",
  },
  violet: {
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    border: "border-violet-500/20",
    line: "bg-violet-500",
    dot: "border-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]",
  },
  amber: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    border: "border-amber-500/20",
    line: "bg-amber-500",
    dot: "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]",
  },
};

function CopyButton({ text }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/5 p-1.5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
      title="복사"
      type="button"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

export default function DownloadPage() {
  return (
    <div className="landing-page min-h-screen bg-[#07111f] text-white">
      {/* Navigation */}
      <nav className="landing-nav fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#07111f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight text-white no-underline">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 text-sm font-black">
              DR
            </span>
            DR Platform
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 no-underline transition-colors hover:text-white"
            >
              홈
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white no-underline transition-all hover:border-white/20 hover:bg-white/10"
            >
              대시보드
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="relative px-6 pb-12 pt-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/6 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Installation Guide
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              설치 및 온보딩 가이드
            </span>
          </h1>
          <p className="mt-4 text-base font-medium text-slate-400 sm:text-lg">
            5단계로 클러스터를 DR Platform에 연결하세요.
          </p>
        </div>
      </section>

      {/* drctl Install */}
      <section className="px-6 pb-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-sky-500/20 bg-white/[0.03] p-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-sky-400" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-black text-white">사전 준비: drctl CLI 설치</h2>
                <p className="text-sm font-medium text-slate-400">DR Platform CLI 도구를 전역으로 설치합니다.</p>
              </div>
            </div>
            <div className="download-code-block relative mt-4 rounded-xl bg-[#0a1628] p-4 font-mono text-sm">
              <CopyButton text="npm install -g drctl" />
              <span className="text-slate-500">$ </span>
              <span className="text-sky-300">npm install</span>
              <span className="text-slate-300"> -g </span>
              <span className="text-emerald-300">drctl</span>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[19px] top-8 bottom-8 w-px bg-gradient-to-b from-sky-500/40 via-violet-500/40 to-emerald-500/40 md:left-[23px]" />

            <div className="space-y-10">
              {STEPS.map((step) => {
                const colors = accentColors[step.accent];
                return (
                  <div key={step.number} className="relative pl-14 md:pl-16">
                    {/* Timeline dot */}
                    <div className={`absolute left-2.5 top-1 h-4 w-4 rounded-full border-[3px] bg-[#07111f] md:left-3 ${colors.dot}`} />

                    <div className={`rounded-2xl border ${colors.border} bg-white/[0.03] p-6 backdrop-blur transition-all hover:bg-white/[0.05]`}>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-black ${colors.badge}`}>
                          Step {step.number}
                        </span>
                        <h3 className="text-lg font-black text-white">{step.title}</h3>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-400">
                        {step.description}
                      </p>

                      {/* Code block */}
                      <div className="download-code-block relative mt-4 overflow-x-auto rounded-xl bg-[#0a1628] p-4 font-mono text-sm leading-relaxed text-slate-300">
                        <CopyButton text={step.code} />
                        <pre className="whitespace-pre-wrap break-all pr-10">{step.code}</pre>
                      </div>

                      {/* Note */}
                      {step.note && (
                        <p className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-500">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          {step.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Next Steps CTA */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-8 text-center backdrop-blur">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-emerald-400" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-white">설치 완료!</h3>
            <p className="mt-2 text-sm font-medium text-slate-400">
              모든 단계를 완료했다면 대시보드에서 클러스터 상태를 확인하세요.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-8 py-3 text-sm font-black text-white no-underline shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl hover:brightness-110"
              >
                대시보드 열기
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3 text-sm font-bold text-slate-300 no-underline transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-xs font-medium text-slate-500">
            © 2026 DR Platform. Cloud-Edge Disaster Recovery.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xs font-medium text-slate-500 no-underline transition-colors hover:text-slate-300">
              홈
            </Link>
            <Link to="/dashboard" className="text-xs font-medium text-slate-500 no-underline transition-colors hover:text-slate-300">
              대시보드
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
