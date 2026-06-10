import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "pulse",
    title: "실시간 클러스터 모니터링",
    description:
      "dr-agent가 노드, 파드, 백업 상태를 자동으로 수집하여 플랫폼에 전송합니다. 장애 발생 시 Alertmanager 웹훅으로 즉시 감지합니다.",
    accent: "emerald",
  },
  {
    icon: "brain",
    title: "AI 기반 복구 우선순위 추천",
    description:
      "정책 기반 스코어링과 AI 분석으로 워크로드별 복구 우선순위를 자동 추천합니다. RTO/RPO 기반의 데이터 중심 의사결정을 지원합니다.",
    accent: "sky",
  },
  {
    icon: "shield",
    title: "운영자 승인 기반 안전한 복구",
    description:
      "AI가 추천한 복구 계획은 운영자의 명시적 승인 후에만 실행됩니다. 자동화와 통제의 균형을 유지합니다.",
    accent: "violet",
  },
  {
    icon: "edge",
    title: "비용 효율적인 엣지 이중화",
    description:
      "경량 K3s 엣지 클러스터와 MinIO 기반 Velero 백업으로 별도 클라우드 DR 리전 없이 재해 복구를 구현합니다.",
    accent: "amber",
  },
];

const ARCH_STEPS = [
  {
    icon: "cloud",
    label: "사용자 클러스터",
    items: ["dr-agent 설치", "상태 자동 전송"],
    accent: "sky",
  },
  {
    icon: "brain",
    label: "DR Platform",
    items: ["AI 분석 및 추천", "운영자 승인"],
    accent: "violet",
  },
  {
    icon: "edge",
    label: "Edge K3s 복구",
    items: ["Velero Restore", "워크로드 복원"],
    accent: "emerald",
  },
];

function FeatureIcon({ name, className = "" }) {
  const icons = {
    pulse: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    brain: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
        <path d="M9 21h6M10 17v4M14 17v4" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    edge: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <path d="M6 6h.01M6 18h.01" />
      </svg>
    ),
    cloud: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
      </svg>
    ),
    arrow: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  };
  return icons[name] || null;
}

const accentMap = {
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
    border: "border-emerald-500/20",
    glow: "hover:shadow-emerald-500/10",
    dotBg: "bg-emerald-400",
  },
  sky: {
    iconBg: "bg-sky-500/10",
    iconText: "text-sky-400",
    border: "border-sky-500/20",
    glow: "hover:shadow-sky-500/10",
    dotBg: "bg-sky-400",
  },
  violet: {
    iconBg: "bg-violet-500/10",
    iconText: "text-violet-400",
    border: "border-violet-500/20",
    glow: "hover:shadow-violet-500/10",
    dotBg: "bg-violet-400",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
    border: "border-amber-500/20",
    glow: "hover:shadow-amber-500/10",
    dotBg: "bg-amber-400",
  },
};

export default function LandingPage() {
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
              to="/download"
              className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 no-underline transition-colors hover:text-white"
            >
              설치 가이드
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

      {/* Hero Section */}
      <section className="landing-hero relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-6 pt-16 text-center">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600/8 blur-[120px]" />
          <div className="absolute right-1/4 top-1/2 h-[400px] w-[500px] rounded-full bg-violet-600/8 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-xs font-bold text-sky-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
            Cloud-Edge Disaster Recovery
          </div>

          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              클라우드-엣지
            </span>
            <br />
            <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
              지능형 DR 플랫폼
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg font-medium leading-relaxed text-slate-400 sm:text-xl">
            Kubernetes 클러스터의 재해를 감지하고
            <br className="hidden sm:block" />
            AI가 복구 우선순위를 추천합니다.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/download"
              className="landing-cta-primary group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-600 px-8 py-3.5 text-base font-black text-white no-underline shadow-lg shadow-sky-500/25 transition-all hover:shadow-xl hover:shadow-sky-500/30 hover:brightness-110"
            >
              시작하기
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 transition-transform group-hover:translate-x-0.5">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-bold text-slate-300 no-underline backdrop-blur transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              대시보드 보기
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-slate-500">
            <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                동작 방식
              </span>
            </h2>
            <p className="mt-4 text-base font-medium text-slate-400">
              3단계 자동화된 재해 감지 → 분석 → 복구 흐름
            </p>
          </div>

          <div className="mt-16 flex flex-col items-center gap-6 md:flex-row md:gap-0">
            {ARCH_STEPS.map((step, index) => {
              const accent = accentMap[step.accent];
              return (
                <div key={step.label} className="flex items-center gap-0">
                  <div className={`landing-arch-card group relative w-64 rounded-2xl border ${accent.border} bg-white/[0.03] p-6 backdrop-blur transition-all hover:bg-white/[0.06]`}>
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${accent.iconBg}`}>
                      <FeatureIcon name={step.icon} className={`h-6 w-6 ${accent.iconText}`} />
                    </div>
                    <h3 className="text-lg font-black text-white">{step.label}</h3>
                    <ul className="mt-3 space-y-1.5">
                      {step.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm font-medium text-slate-400">
                          <span className={`h-1 w-1 rounded-full ${accent.dotBg}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    {/* Step number badge */}
                    <div className="absolute -top-3 right-4 rounded-full border border-white/10 bg-[#0f1d35] px-3 py-0.5 text-xs font-black text-slate-400">
                      Step {index + 1}
                    </div>
                  </div>

                  {/* Arrow between steps */}
                  {index < ARCH_STEPS.length - 1 && (
                    <div className="hidden px-4 md:block">
                      <FeatureIcon name="arrow" className="h-8 w-8 text-slate-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                핵심 기능
              </span>
            </h2>
            <p className="mt-4 text-base font-medium text-slate-400">
              운영 안정성과 비용 효율성을 동시에 달성하는 지능형 DR
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const accent = accentMap[feature.accent];
              return (
                <div
                  key={feature.title}
                  className={`landing-feature-card group relative rounded-2xl border ${accent.border} bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06] hover:shadow-2xl ${accent.glow}`}
                >
                  <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${accent.iconBg}`}>
                    <FeatureIcon name={feature.icon} className={`h-5 w-5 ${accent.iconText}`} />
                  </div>
                  <h3 className="text-base font-black text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              지금 시작하세요
            </span>
          </h2>
          <p className="mt-4 text-base font-medium text-slate-400">
            dr-agent를 설치하고 클러스터를 DR Platform에 연결하세요.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/download"
              className="landing-cta-primary inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-600 px-8 py-3.5 text-base font-black text-white no-underline shadow-lg shadow-sky-500/25 transition-all hover:shadow-xl hover:shadow-sky-500/30 hover:brightness-110"
            >
              설치 가이드 보기
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-bold text-slate-300 no-underline backdrop-blur transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              대시보드 열기
            </Link>
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
            <Link to="/download" className="text-xs font-medium text-slate-500 no-underline transition-colors hover:text-slate-300">
              설치 가이드
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
