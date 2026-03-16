import Head from "next/head";
import { useState, useEffect } from "react";
import Nav from "@/components/Nav";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

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
      <style jsx>{`
        .intent-tbl td.bar-cell {
          text-align: right;
        }
        .bar-wrap {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .bar-fill {
          display: inline-block;
          height: 6px;
          border-radius: 3px;
        }
        .bar-fill.router { background: var(--success); }
        .bar-fill.haiku { background: var(--accent); }
        .bar-label {
          font-family: var(--font-mono);
          font-size: 11px;
          min-width: 32px;
        }
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          cursor: pointer;
          user-select: none;
        }
        .category-header.open {
          border-radius: 4px 4px 0 0;
        }
        .category-header.closed {
          border-radius: 4px;
        }
        .category-label {
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 1px;
        }
        .category-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
        }
        .category-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-top: none;
          border-radius: 0 0 4px 4px;
        }
        .unavail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }
        .unavail-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          box-shadow: var(--card-shadow);
        }
        .unavail-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--danger);
          margin-top: 4px;
          flex-shrink: 0;
        }
        .unavail-name {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .unavail-reason {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .clar-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }
        .clar-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px 16px;
          box-shadow: var(--card-shadow);
        }
        .clar-val {
          font-family: var(--font-mono);
          font-size: 22px;
          font-weight: 500;
        }
        .clar-label {
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-top: 4px;
          font-family: var(--font-mono);
        }
        .slot-val {
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 500;
          color: var(--accent-2);
        }
        .slot-label {
          font-size: 10px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .empty-state {
          padding: 32px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-secondary);
          text-align: center;
        }
        .expo-brands-row {
          display: flex;
          gap: 32px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .brands-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-right: 8px;
        }
      `}</style>

      <div className="page">
        <Nav subtitle="Intelligence" />

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* A) Router Rules */}
            <div className="mb-32">
              <div className="section-title mb-16">
                Router Rules {routerRules && `(${routerRules.total_rules} rules)`}
              </div>
              {routerRules && (
                <>
                  <table className="tbl mb-16">
                    <thead>
                      <tr>
                        <th>Intent</th>
                        <th className="r">Keywords</th>
                        <th>Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routerRules.rules.map((rule, i) => (
                        <tr key={i}>
                          <td>
                            <span style={intentBadge(rule.intent)}>{rule.intent}</span>
                          </td>
                          <td className="mono r" style={{ color: "var(--accent)" }}>
                            {rule.keyword_count}
                          </td>
                          <td className="mono muted" style={{ fontSize: 11 }}>
                            {rule.sample_keywords.join("  |  ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="expo-brands-row">
                    <div>
                      <span className="brands-label">Expo Brands:</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {routerRules.expo_brands.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(", ")}
                      </span>
                    </div>
                    <div>
                      <span className="brands-label">Agent Names:</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {routerRules.agent_names.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(", ")}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* B) Intent Map */}
            <div className="mb-32">
              <div className="section-title mb-16">
                Intent Map {intentStats && `(${intentStats.total_messages} total messages)`}
              </div>
              {intentStats?.intents?.length > 0 ? (
                <table className="tbl intent-tbl">
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
                          className={col.key !== "intent" ? "r" : ""}
                        >
                          {col.label}{sortIndicator(col.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIntents().map((row, i) => (
                      <tr key={i}>
                        <td>
                          <span style={intentBadge(row.intent)}>{row.intent}</span>
                        </td>
                        <td className="mono r">
                          {fmtNum(row.count)}
                        </td>
                        <td className="mono r" style={{ color: "var(--accent)" }}>
                          {fmtNum(row.tokens)}
                        </td>
                        <td className="mono r muted">
                          {row.avg_duration ? `${fmtNum(row.avg_duration)}ms` : "\u2014"}
                        </td>
                        <td className="bar-cell">
                          <div className="bar-wrap">
                            <span className="bar-fill router" style={{ width: Math.max(2, row.router_pct * 0.8) }} />
                            <span className="bar-label">{row.router_pct}%</span>
                          </div>
                        </td>
                        <td className="bar-cell">
                          <div className="bar-wrap">
                            <span className="bar-fill haiku" style={{ width: Math.max(2, row.haiku_pct * 0.8) }} />
                            <span className="bar-label">{row.haiku_pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No intent data yet</div>
              )}
            </div>

            {/* C) Benchmark */}
            <div className="mb-32">
              <div className="section-title mb-16">
                Benchmark {benchmark && `(${benchmark.total} questions)`}
              </div>
              {benchmark?.questions?.length > 0 ? (
                <div>
                  {Object.entries(groupedQuestions()).map(([category, questions]) => (
                    <div key={category} style={{ marginBottom: 8 }}>
                      <div
                        onClick={() => toggleCategory(category)}
                        className={`category-header ${openCategories[category] ? "open" : "closed"}`}
                      >
                        <span className="category-label">
                          {openCategories[category] ? "\u25BC" : "\u25B6"} {category}
                        </span>
                        <span className="category-count">
                          {questions.length} questions
                        </span>
                      </div>
                      {openCategories[category] && (
                        <table className="category-table">
                          <thead>
                            <tr>
                              <th style={{ width: 40, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>ID</th>
                              <th style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>Question</th>
                              <th style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>Expected Intent</th>
                              <th style={{ width: 50, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>Lang</th>
                            </tr>
                          </thead>
                          <tbody>
                            {questions.map(q => (
                              <tr key={q.id}>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 11 }}>
                                  {q.id}
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                  {q.question}
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                                  <span style={intentBadge(q.expected_intent)}>{q.expected_intent}</span>
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-2)', textAlign: 'center' }}>
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
                <div className="empty-state">No benchmark data found</div>
              )}
            </div>

            {/* D) Unavailable Metrics */}
            <div className="mb-32">
              <div className="section-title mb-16">Unavailable Metrics</div>
              <div className="unavail-grid">
                {UNAVAILABLE_METRICS.map(m => (
                  <div key={m.metric} className="unavail-card">
                    <span className="unavail-dot" />
                    <div>
                      <div className="unavail-name">{m.metric}</div>
                      <div className="unavail-reason">{m.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* E) Clarification Stats */}
            <div className="mb-32">
              <div className="section-title mb-16">Clarification Stats</div>
              {clarStats && clarStats.total_clarifications > 0 ? (
                <div className="clar-grid">
                  <div className="clar-card">
                    <div className="clar-val" style={{ color: "var(--accent)" }}>
                      {fmtNum(clarStats.total_clarifications)}
                    </div>
                    <div className="clar-label">Total Clarifications</div>
                  </div>
                  <div className="clar-card">
                    <div className="clar-val" style={{ color: clarStats.resolve_rate >= 70 ? "var(--success)" : "var(--warning)" }}>
                      {clarStats.resolve_rate}%
                    </div>
                    <div className="clar-label">Resolve Rate</div>
                  </div>
                  <div className="clar-card">
                    <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                      {Object.entries(clarStats.by_slot || {}).map(([slot, count]) => (
                        <div key={slot}>
                          <div className="slot-val">{count}</div>
                          <div className="slot-label">{slot}</div>
                        </div>
                      ))}
                    </div>
                    <div className="clar-label" style={{ marginTop: 8 }}>By Slot</div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">No clarification data yet</div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
