import { useEffect, useMemo, useState } from "react";

const alerts = [
  {
    id: "ZBX-2401",
    level: "critical",
    target: "cloud-main / kube-apiserver",
    title: "메인 클러스터 API 서버 응답 없음",
    detail: "3개 control-plane 노드에서 120초 이상 heartbeat가 수신되지 않았습니다.",
    time: "02:14:08",
  },
  {
    id: "ZBX-2398",
    level: "high",
    target: "prod / payment-api",
    title: "Payment API 전체 replica 중단",
    detail: "가용 replica 0/5 · 결제 승인 트래픽이 실패하고 있습니다.",
    time: "02:13:44",
  },
  {
    id: "ZBX-2396",
    level: "warning",
    target: "prod / order-db",
    title: "주문 DB 볼륨 I/O 지연",
    detail: "최근 5분 평균 write latency가 임계값 250ms를 초과했습니다.",
    time: "02:12:19",
  },
];

const recommendations = [
  {
    tier: 1,
    service: "auth-service",
    namespace: "prod-core",
    score: 98,
    rto: "4분",
    reason: "모든 고객 요청의 인증 선행 조건이며 Edge K3s 리소스로 즉시 수용 가능합니다.",
    labels: ["고객 진입점", "백업 최신"],
  },
  {
    tier: 1,
    service: "payment-api",
    namespace: "prod-payment",
    score: 96,
    rto: "7분",
    reason: "직접 매출 영향이 발생 중이며 최근 백업의 데이터 정합성이 검증되었습니다.",
    labels: ["매출 영향", "RPO 3분"],
  },
  {
    tier: 1,
    service: "api-gateway",
    namespace: "prod-core",
    score: 92,
    rto: "3분",
    reason: "복구 서비스로 트래픽을 전달하기 위해 인증 서비스와 함께 우선 복원이 필요합니다.",
    labels: ["트래픽 전환", "경량"],
  },
  {
    tier: 2,
    service: "order-api",
    namespace: "prod-order",
    score: 81,
    rto: "12분",
    reason: "주문 조회를 복구할 수 있으나 DB I/O 상태 확인 후 순차 복원을 권장합니다.",
    labels: ["상태 저장", "의존성 확인"],
  },
];

const initialLogs = [
  "$ drctl status --target edge-k3s",
  "✓ edge-k3s reachable · 4 nodes ready · Velero 1.15.2",
  "$ velero backup describe full-prod-20260606-0200",
  "✓ backup completed · 02:00:32 KST · 42 namespaces",
];

function Icon({ name, size = 18 }) {
  const paths = {
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
    brain: <><path d="M9 4a3 3 0 0 0-5 2 3 3 0 0 0 0 5 3.5 3.5 0 0 0 5 5.5V4Zm6 0a3 3 0 0 1 5 2 3 3 0 0 1 0 5 3.5 3.5 0 0 1-5 5.5V4ZM9 9H6m9 0h3M9 14H7m8 0h2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    cloud: <><path d="M6 18h11a4 4 0 0 0 .4-8A6 6 0 0 0 6 8a5 5 0 0 0 0 10Z" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5m-16 7v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5m-18 4 9 5 9-5" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4L3 10m1-6v6h6M4 13a8 8 0 0 0 14.8 4l2.2-3m-1 6v-6h-6" /></>,
    server: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></>,
    shield: <><path d="M12 3 4 6v5c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-5" /></>,
    sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Zm6 10 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" /></>,
    terminal: <><path d="m5 7 4 4-4 4m6 0h8" /><rect x="2" y="3" width="20" height="18" rx="2" /></>,
    triangle: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    zap: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function StatusBadge({ level, children }) {
  return <span className={`badge ${level}`}>{children}</span>;
}

function AlertCard({ alert, selected, onSelect }) {
  return (
    <button className={`alert-card ${selected ? "selected" : ""}`} onClick={onSelect} type="button">
      <span className={`severity-line ${alert.level}`} />
      <span className="alert-card-top">
        <StatusBadge level={alert.level}>{alert.level.toUpperCase()}</StatusBadge>
        <span className="alert-time">{alert.time}</span>
      </span>
      <strong>{alert.title}</strong>
      <span className="alert-target">{alert.target}</span>
      <p>{alert.detail}</p>
      <span className="alert-card-bottom">
        <code>{alert.id}</code>
        <span>영향 분석 보기 <Icon name="chevron" size={14} /></span>
      </span>
    </button>
  );
}

function RecommendationCard({ item, selected, onToggle }) {
  return (
    <article className={`recommendation-card ${selected ? "selected" : ""}`}>
      <button className="recommendation-select" type="button" onClick={onToggle} aria-pressed={selected}>
        <span className={`tier tier-${item.tier}`}>TIER {item.tier}</span>
        <span className={`selection-box ${selected ? "checked" : ""}`}>
          {selected && <Icon name="check" size={14} />}
        </span>
      </button>
      <div className="recommendation-main">
        <div>
          <strong>{item.service}</strong>
          <code>{item.namespace}</code>
        </div>
        <div className="score-ring" style={{ "--score": `${item.score * 3.6}deg` }}>
          <span>{item.score}</span>
        </div>
      </div>
      <p>{item.reason}</p>
      <div className="label-row">
        {item.labels.map((label) => <span key={label}>{label}</span>)}
        <span className="rto"><Icon name="clock" size={13} /> 목표 RTO {item.rto}</span>
      </div>
    </article>
  );
}

function App() {
  const [selectedAlert, setSelectedAlert] = useState(alerts[0].id);
  const [selectedServices, setSelectedServices] = useState(() => new Set(["auth-service", "payment-api", "api-gateway"]));
  const [restoreState, setRestoreState] = useState("idle");
  const [logs, setLogs] = useState(initialLogs);
  const [now, setNow] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem("dr-platform-sidebar-collapsed") === "true",
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dr-platform-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const selectedItems = useMemo(
    () => recommendations.filter((item) => selectedServices.has(item.service)),
    [selectedServices],
  );

  const toggleService = (service) => {
    if (restoreState === "running") return;
    setSelectedServices((current) => {
      const next = new Set(current);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next;
    });
  };

  const runRestore = async () => {
    if (!selectedItems.length || restoreState === "running") return;

    setRestoreState("running");
    const services = selectedItems.map((item) => item.service).join(",");
    const runLogs = [
      `$ drctl restore run --backup full-prod-20260606-0200 --services ${services}`,
      "→ AI 복구 계획 승인 · restore manifest 생성 중",
      "→ Velero restore 요청 전송 · target=edge-k3s",
      "→ Tier 1 namespace 및 의존 리소스 복원 중",
      "✓ Restore accepted · restore-id=dr-20260606-0215",
      "✓ 트래픽 전환 준비 완료 · 운영자 DNS 승인 대기",
    ];

    setLogs((current) => [...current, "", runLogs[0]]);
    for (const line of runLogs.slice(1)) {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      setLogs((current) => [...current, line]);
    }
    setRestoreState("complete");
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <img src="/main-logo.png" alt="DR Platform" />
          </div>
          <div className="brand-copy">
            <h1>DR Platform</h1>
            <p>Intelligent Recovery Console</p>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>

        <div className="sidebar-status">
          <p className="sidebar-label">SYSTEM STATUS</p>
          <div className="system-state critical" title="Disaster detected · 메인 클러스터 장애 대응 중">
            <span className="pulse-dot" />
            <div className="system-state-copy">
              <strong>Disaster detected</strong>
              <p>메인 클러스터 장애 대응 중</p>
            </div>
          </div>
          <div className="sidebar-flow">
            <div className="flow-step complete" title="Zabbix 감지 완료"><Icon name="activity" /><span>Zabbix 감지</span><Icon name="check" size={14} /></div>
            <div className="flow-line complete" />
            <div className="flow-step complete" title="AI 우선순위 분석 완료"><Icon name="brain" /><span>AI 우선순위</span><Icon name="check" size={14} /></div>
            <div className="flow-line active" />
            <div className="flow-step active" title="Edge 복구 진행"><Icon name="refresh" /><span>Edge 복구</span><span className="step-number">3</span></div>
            <div className="flow-line" />
            <div className="flow-step" title="트래픽 전환 대기"><Icon name="cloud" /><span>트래픽 전환</span><span className="step-number">4</span></div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div title="Zabbix Webhook · LIVE"><span className="connection-dot" /><span>Zabbix Webhook</span><strong>LIVE</strong></div>
          <div title="Edge K3s · READY"><span className="connection-dot" /><span>Edge K3s</span><strong>READY</strong></div>
          <div title="MinIO Backup · SYNCED"><span className="connection-dot" /><span>MinIO Backup</span><strong>SYNCED</strong></div>
          <p>CLI backbone · drctl v0.1.0</p>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">DISASTER RECOVERY OPERATIONS</p>
            <h2>복구 관제 대시보드</h2>
          </div>
          <div className="topbar-actions">
            <span className="time-block">
              <Icon name="clock" size={16} />
              <span>{now.toLocaleTimeString("ko-KR", { hour12: false, timeZone: "Asia/Seoul" })} KST</span>
            </span>
            <StatusBadge level="critical"><span className="pulse-dot" /> INCIDENT ACTIVE</StatusBadge>
          </div>
        </header>

        <section className="metric-grid" aria-label="복구 현황 요약">
          <article className="metric-card danger">
            <span className="metric-icon"><Icon name="triangle" /></span>
            <div><span>Active incidents</span><strong>3</strong><p>Critical 1 · High 1 · Warning 1</p></div>
          </article>
          <article className="metric-card">
            <span className="metric-icon"><Icon name="database" /></span>
            <div><span>Latest full backup</span><strong>14m</strong><p>02:00:32 KST · MinIO verified</p></div>
          </article>
          <article className="metric-card">
            <span className="metric-icon"><Icon name="server" /></span>
            <div><span>Edge capacity</span><strong>68%</strong><p>4 nodes ready · 27 vCPU free</p></div>
          </article>
          <article className="metric-card">
            <span className="metric-icon"><Icon name="shield" /></span>
            <div><span>Estimated recovery</span><strong>7m</strong><p>Tier 1 services · AI confidence 96%</p></div>
          </article>
        </section>

        <div className="dashboard-grid">
          <section className="panel alert-panel">
            <div className="section-heading">
              <div>
                <span className="section-icon danger"><Icon name="activity" /></span>
                <div><p>ZABBIX LIVE FEED</p><h3>장애 상태</h3></div>
              </div>
              <button className="icon-button" type="button" aria-label="새로고침"><Icon name="refresh" size={16} /> 새로고침</button>
            </div>
            <div className="alert-list">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  selected={selectedAlert === alert.id}
                  onSelect={() => setSelectedAlert(alert.id)}
                />
              ))}
            </div>
          </section>

          <section className="panel ai-panel">
            <div className="section-heading">
              <div>
                <span className="section-icon ai"><Icon name="sparkles" /></span>
                <div><p>AI DR ORCHESTRATOR</p><h3>복구 우선순위 추천</h3></div>
              </div>
              <StatusBadge level="ready">분석 완료 · 96%</StatusBadge>
            </div>
            <div className="ai-summary">
              <Icon name="brain" size={22} />
              <p><strong>핵심 서비스 3개를 먼저 복구하세요.</strong> 현재 Edge 자원에서 인증 및 결제 흐름을 7분 내 재개할 수 있습니다.</p>
            </div>
            <div className="recommendation-list">
              {recommendations.map((item) => (
                <RecommendationCard
                  key={item.service}
                  item={item}
                  selected={selectedServices.has(item.service)}
                  onToggle={() => toggleService(item.service)}
                />
              ))}
            </div>
          </section>

          <section className="panel restore-panel">
            <div className="restore-copy">
              <div className="section-heading">
                <div>
                  <span className="section-icon restore"><Icon name="zap" /></span>
                  <div><p>OPERATOR APPROVAL</p><h3>복구 실행</h3></div>
                </div>
                <StatusBadge level={restoreState === "complete" ? "ready" : "warning"}>
                  {restoreState === "complete" ? "RESTORE ACCEPTED" : "APPROVAL REQUIRED"}
                </StatusBadge>
              </div>

              <div className="restore-plan">
                <div><span>복구 대상</span><strong>{selectedItems.length} services</strong></div>
                <div><span>백업</span><strong>full-prod-20260606-0200</strong></div>
                <div><span>대상 클러스터</span><strong>edge-k3s / standby</strong></div>
              </div>

              <div className="service-chips">
                {selectedItems.map((item) => (
                  <span key={item.service}><span className="connection-dot" />{item.service}<button type="button" onClick={() => toggleService(item.service)}>×</button></span>
                ))}
              </div>

              <div className="approval-note">
                <Icon name="shield" size={18} />
                <p>버튼 실행 시 선택한 서비스에 대한 Velero Restore가 Edge K3s로 전달됩니다. DNS 전환은 복원 검증 후 별도 승인됩니다.</p>
              </div>

              <button
                className={`restore-button ${restoreState}`}
                type="button"
                onClick={runRestore}
                disabled={!selectedItems.length || restoreState === "running"}
              >
                {restoreState === "running" ? <><span className="spinner" /> 복구 명령 실행 중</> : <><Icon name="zap" /> {restoreState === "complete" ? "복구 명령 재실행" : "선택 서비스 복구 실행"}</>}
              </button>
            </div>

            <div className="terminal">
              <div className="terminal-topbar">
                <span><i /><i /><i /></span>
                <strong><Icon name="terminal" size={14} /> drctl · recovery stream</strong>
                <span className="terminal-live"><span className="connection-dot" />LIVE</span>
              </div>
              <pre>{logs.map((line, index) => <span key={`${index}-${line}`}>{line || " "}</span>)}</pre>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
