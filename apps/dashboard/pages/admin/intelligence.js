import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const navStyle = {
  fontFamily: '"DM Mono", monospace',
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  textDecoration: "none",
};

const activeNavStyle = { ...navStyle, color: "var(--accent)", fontWeight: 500 };

const sectionHeader = {
  fontFamily: '"DM Mono", monospace',
  fontSize: 11,
  color: "var(--text-secondary)",
  letterSpacing: 3,
  textTransform: "uppercase",
  marginBottom: 16,
};

const thStyle = {
  fontFamily: '"DM Mono", monospace',
  fontSize: 10,
  color: "var(--text-secondary)",
  letterSpacing: 1.5,
  textTransform: "uppercase",
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: "1px solid var(--border)",
  background: "var(--surface-2)",
};

const tdStyle = {
  padding: "10px 14px",
  borderBottom: "1px solid var(--border)",
  fontSize: 12,
};

function intentBadge(intent) {
  const colors = {
    expo_progress: "#4A9EBF",
    agent_performance: "#C8A97A",
    top_agents: "#C8A97A",
    expo_list: "#4A9EBF",
    days_to_event: "#2ECC71",
    payment_status: "#D4A017",
    rebooking_rate: "#9B59B6",
    price_per_m2: "#E67E22",
    monthly_trend: "#1ABC9C",
    revenue_summary: "#2ECC71",
    country_count: "#3498DB",
    exhibitors_by_country: "#3498DB",
    agent_country_breakdown: "#E67E22",
    agent_expo_breakdown: "#E67E22",
    expo_agent_breakdown: "#4A9EBF",
    expo_company_list: "#4A9EBF",
    cluster_performance: "#9B59B6",
    general_stats: "#5A7080",
    compound: "#C0392B",
  };
  const color = colors[intent] || "var(--text-secondary)";
  return {
    fontFamily: '"DM Mono", monospace',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: 1,
    padding: "3px 8px",
    borderRadius: 3,
    color,
    background: `${color}15`,
    border: `1px solid ${color}40`,
    display: "inline-block",
  };
}

const LANG_FLAGS = { en: "EN", tr: "TR", fr: "FR" };

const UNAVAILABLE_METRICS = [
  { metric: "payment_balance", reason: "Payment balance not synced from Zoho", status: "unavailable" },
  { metric: "currency", reason: "No exchange rate data", status: "unavailable" },
  { metric: "salary", reason: "Out of scope", status: "unavailable" },
  { metric: "general_knowledge", reason: "Out of scope", status: "unavailable" },
];

function fmtNum(n) {
  if (n == null) return "\u2014";
  return Number(n).toLocaleString("en-US");
}

export default function IntelligencePage() {
  const [routerRules, setRouterRules] = useState(null);
  const [intentStats, setIntentStats] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [clarStats, setClarStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState("count");
  const [sortDir, setSortDir] = useState("desc");
  const [openCategories, setOpenCategories] = useState({});

  useEffect(() => {
    Promise.all([
      fetch(`${API}/intelligence/router-rules`).then(r => r.json()).catch(() => null),
      fetch(`${API}/intelligence/intent-stats`).then(r => r.json()).catch(() => null),
      fetch(`${API}/intelligence/benchmark`).then(r => r.json()).catch(() => null),
      fetch(`${API}/intelligence/clarification-stats`).then(r => r.json()).catch(() => null),
    ]).then(([rules, stats, bench, clar]) => {
      setRouterRules(rules);
      setIntentStats(stats);
      setBenchmark(bench);
      setClarStats(clar);
      setLoading(false);
    });
  }, []);

  function toggleCategory(cat) {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function sortedIntents() {
    if (!intentStats?.intents) return [];
    const list = [...intentStats.intents];
    list.sort((a, b) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }

  function groupedQuestions() {
    if (!benchmark?.questions) return {};
    const groups = {};
    for (const q of benchmark.questions) {
      const cat = q.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(q);
    }
    return groups;
  }

  const sortIndicator = (col) => sortCol === col ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  return (
    <>
      <Head><title>ELIZA | Intelligence</title></Head>
      <style jsx global>{`
        :root {
          --bg: #080B10; --surface: #0E1318; --surface-2: #141B22;
          --border: #1E2A35; --text-primary: #E8EDF2; --text-secondary: #5A7080;
          --accent: #C8A97A; --accent-2: #4A9EBF;
          --danger: #C0392B; --warning: #D4A017; --success: #2ECC71;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--bg); color: var(--text-primary); font-family: "DM Sans", -apple-system, sans-serif; min-height: 100vh; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 24, borderBottom: "1px solid var(--accent)", marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 28, fontWeight: 500, letterSpacing: 6 }}>
              ELIZA<span style={{ color: "var(--accent)" }}>.</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>Intelligence Panel</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/admin/logs" style={navStyle}>Logs</Link>
            <Link href="/admin/intelligence" style={activeNavStyle}>Intelligence</Link>
            <Link href="/admin/system" style={navStyle}>System</Link>
            <Link href="/admin" style={navStyle}>Users</Link>
            <Link href="/" style={navStyle}>War Room &rarr;</Link>
            <Link href="/sales" style={navStyle}>Sales</Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>Loading...</div>
        ) : (
          <>
            {/* A) Router Rules */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>
                Router Rules {routerRules && `(${routerRules.total_rules} rules)`}
              </div>
              {routerRules && (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, marginBottom: 16 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Intent</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Keywords</th>
                        <th style={thStyle}>Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routerRules.rules.map((rule, i) => (
                        <tr key={i}>
                          <td style={tdStyle}>
                            <span style={intentBadge(rule.intent)}>{rule.intent}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>
                            {rule.keyword_count}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace' }}>
                            {rule.sample_keywords.join("  |  ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", gap: 32, fontSize: 12, color: "var(--text-secondary)" }}>
                    <div>
                      <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-secondary)", marginRight: 8 }}>Expo Brands:</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {routerRules.expo_brands.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(", ")}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-secondary)", marginRight: 8 }}>Agent Names:</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {routerRules.agent_names.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(", ")}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* B) Intent Map */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>
                Intent Map {intentStats && `(${intentStats.total_messages} total messages)`}
              </div>
              {intentStats?.intents?.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
                  <thead>
                    <tr>
                      {[
                        { key: "intent", label: "Intent" },
                        { key: "count", label: "Count" },
                        { key: "tokens", label: "Tokens" },
                        { key: "avg_duration", label: "Avg Duration" },
                        { key: "router_pct", label: "Router %" },
                        { key: "haiku_pct", label: "Haiku %" },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          style={{
                            ...thStyle,
                            cursor: "pointer",
                            textAlign: col.key === "intent" ? "left" : "right",
                            userSelect: "none",
                          }}
                        >
                          {col.label}{sortIndicator(col.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIntents().map((row, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>
                          <span style={intentBadge(row.intent)}>{row.intent}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: '"DM Mono", monospace' }}>
                          {fmtNum(row.count)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>
                          {fmtNum(row.tokens)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>
                          {row.avg_duration ? `${fmtNum(row.avg_duration)}ms` : "\u2014"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                            <span style={{
                              display: "inline-block",
                              height: 6,
                              width: Math.max(2, row.router_pct * 0.8),
                              background: "var(--success)",
                              borderRadius: 3,
                            }} />
                            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, minWidth: 32 }}>
                              {row.router_pct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                            <span style={{
                              display: "inline-block",
                              height: 6,
                              width: Math.max(2, row.haiku_pct * 0.8),
                              background: "var(--accent)",
                              borderRadius: 3,
                            }} />
                            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, minWidth: 32 }}>
                              {row.haiku_pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", textAlign: "center" }}>
                  No intent data yet
                </div>
              )}
            </div>

            {/* C) Benchmark */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>
                Benchmark {benchmark && `(${benchmark.total} questions)`}
              </div>
              {benchmark?.questions?.length > 0 ? (
                <div>
                  {Object.entries(groupedQuestions()).map(([category, questions]) => (
                    <div key={category} style={{ marginBottom: 8 }}>
                      <div
                        onClick={() => toggleCategory(category)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: openCategories[category] ? "4px 4px 0 0" : 4,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, letterSpacing: 1 }}>
                          {openCategories[category] ? "\u25BC" : "\u25B6"} {category}
                        </span>
                        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)" }}>
                          {questions.length} questions
                        </span>
                      </div>
                      {openCategories[category] && (
                        <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface-2)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 4px 4px" }}>
                          <thead>
                            <tr>
                              <th style={{ ...thStyle, width: 40 }}>ID</th>
                              <th style={thStyle}>Question</th>
                              <th style={thStyle}>Expected Intent</th>
                              <th style={{ ...thStyle, width: 50 }}>Lang</th>
                            </tr>
                          </thead>
                          <tbody>
                            {questions.map(q => (
                              <tr key={q.id}>
                                <td style={{ ...tdStyle, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)", fontSize: 11 }}>
                                  {q.id}
                                </td>
                                <td style={{ ...tdStyle, fontSize: 13 }}>
                                  {q.question}
                                </td>
                                <td style={tdStyle}>
                                  <span style={intentBadge(q.expected_intent)}>{q.expected_intent}</span>
                                </td>
                                <td style={{ ...tdStyle, fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--accent-2)", textAlign: "center" }}>
                                  {LANG_FLAGS[q.language] || q.language}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", textAlign: "center" }}>
                  No benchmark data found
                </div>
              )}
            </div>

            {/* D) Unavailable Metrics */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>Unavailable Metrics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {UNAVAILABLE_METRICS.map(m => (
                  <div key={m.metric} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: 16,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}>
                    <span style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--danger)",
                      marginTop: 4,
                      flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                        {m.metric}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {m.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* E) Clarification Stats */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>Clarification Stats</div>
              {clarStats && clarStats.total_clarifications > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "20px 16px" }}>
                    <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 22, fontWeight: 500, color: "var(--accent)" }}>
                      {fmtNum(clarStats.total_clarifications)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4, fontFamily: '"DM Mono", monospace' }}>
                      Total Clarifications
                    </div>
                  </div>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "20px 16px" }}>
                    <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 22, fontWeight: 500, color: clarStats.resolve_rate >= 70 ? "var(--success)" : "var(--warning)" }}>
                      {clarStats.resolve_rate}%
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4, fontFamily: '"DM Mono", monospace' }}>
                      Resolve Rate
                    </div>
                  </div>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "20px 16px" }}>
                    <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                      {Object.entries(clarStats.by_slot || {}).map(([slot, count]) => (
                        <div key={slot}>
                          <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 16, fontWeight: 500, color: "var(--accent-2)" }}>{count}</div>
                          <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, textTransform: "uppercase" }}>{slot}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 8, fontFamily: '"DM Mono", monospace' }}>
                      By Slot
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", textAlign: "center" }}>
                  No clarification data yet
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
