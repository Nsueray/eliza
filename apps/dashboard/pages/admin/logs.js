import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";
import { Doughnut, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

function fmtNum(n) {
  if (n == null) return "\u2014";
  return Number(n).toLocaleString("en-US");
}

function fmtTime(d) {
  if (!d) return "\u2014";
  const dt = new Date(d);
  return dt.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDate(d) {
  if (!d) return "\u2014";
  const dt = new Date(d);
  return dt.toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtChartDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CopyButton({ log }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = [
      `MESSAGE: ${log.message_text || "-"}`,
      `REWRITE: ${log.rewritten_question || "-"}`,
      `INTENT: ${log.intent || "-"}`,
      `MODEL: ${log.model_intent || "-"} -> ${log.model_answer || "-"}`,
      `RESPONSE: ${log.response_text || "-"}`,
      `TOKENS: ${fmtNum(log.total_tokens)} | DURATION: ${log.duration_ms ? fmtNum(log.duration_ms) + "ms" : "-"}`,
      log.error ? `ERROR: ${log.error}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontFamily: '"DM Mono", monospace', fontSize: 10, padding: "4px 10px",
        border: `1px solid ${copied ? "rgba(46,204,113,0.4)" : "var(--border)"}`,
        borderRadius: 4, background: copied ? "rgba(46,204,113,0.1)" : "transparent",
        color: copied ? "var(--success)" : "var(--text-secondary)", cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      title="Copy log to clipboard"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Section Header ───
function SectionHeader({ children }) {
  return (
    <div style={{
      fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)",
      letterSpacing: 3, textTransform: "uppercase", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

// ─── Summary Cards ───
function SummaryCards({ data }) {
  if (!data) return null;
  const cards = [
    { label: "Total Messages", value: fmtNum(data.total_messages), icon: "MSG" },
    { label: "Active Users", value: fmtNum(data.unique_users), icon: "USR" },
    { label: "Total Tokens", value: fmtNum(data.total_tokens), icon: "TKN" },
    { label: "Avg Duration", value: data.avg_duration_ms ? `${fmtNum(data.avg_duration_ms)}ms` : "\u2014", icon: "DUR" },
    { label: "Errors", value: fmtNum(data.error_count), icon: "ERR" },
    { label: "Clarifications", value: fmtNum(data.clarification_count), icon: "CLR" },
  ];
  return (
    <div className="logs-summary-grid">
      {cards.map(c => (
        <div key={c.label} className="logs-summary-card">
          <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, color: "var(--accent-2)", marginBottom: 8 }}>{c.icon}</div>
          <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 22, fontWeight: 500, color: "var(--accent)" }}>{c.value}</div>
          <div style={{
            fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1.5,
            textTransform: "uppercase", marginTop: 6, fontFamily: '"DM Mono", monospace',
          }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Intent Routing Doughnut ───
function IntentRoutingChart({ data }) {
  if (!data || data.length === 0) return null;

  const colorMap = {
    router: "#2ECC71",
    haiku: "#C8A97A",
    hybrid_sql: "#4A9EBF",
  };
  const total = data.reduce((s, d) => s + parseInt(d.count), 0);

  const chartData = {
    labels: data.map(d => d.model_intent || "unknown"),
    datasets: [{
      data: data.map(d => parseInt(d.count)),
      backgroundColor: data.map(d => colorMap[d.model_intent] || "#5A7080"),
      borderColor: "var(--surface)",
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#141B22",
        titleFont: { family: "DM Mono" },
        bodyFont: { family: "DM Mono" },
        borderColor: "#1E2A35",
        borderWidth: 1,
      },
    },
  };

  return (
    <div className="logs-chart-panel">
      <SectionHeader>Intent Routing</SectionHeader>
      <div className="logs-doughnut-row">
        <div style={{ width: 200, height: 200, flexShrink: 0 }}>
          <Doughnut data={chartData} options={options} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map(d => {
            const pct = total > 0 ? ((parseInt(d.count) / total) * 100).toFixed(1) : 0;
            const color = colorMap[d.model_intent] || "#5A7080";
            return (
              <div key={d.model_intent} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 13, color: "var(--text-primary)", minWidth: 90 }}>
                  {d.model_intent || "unknown"}
                </span>
                <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 13, color: "var(--accent)" }}>
                  {fmtNum(d.count)}
                </span>
                <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)" }}>
                  ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Daily Bar Chart ───
function DailyChart({ data }) {
  if (!data || data.length === 0) return null;

  const sorted = [...data].reverse();

  const chartData = {
    labels: sorted.map(d => fmtChartDate(d.date)),
    datasets: [{
      label: "Messages",
      data: sorted.map(d => parseInt(d.messages)),
      backgroundColor: "rgba(200, 169, 122, 0.6)",
      borderColor: "rgba(200, 169, 122, 0.8)",
      borderWidth: 1,
      borderRadius: 3,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#141B22",
        titleFont: { family: "DM Mono" },
        bodyFont: { family: "DM Mono" },
        borderColor: "#1E2A35",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#5A7080", font: { family: "DM Mono", size: 10 }, maxRotation: 45 },
        grid: { color: "rgba(30,42,53,0.5)" },
        border: { color: "#1E2A35" },
      },
      y: {
        ticks: { color: "#5A7080", font: { family: "DM Mono", size: 10 } },
        grid: { color: "rgba(30,42,53,0.5)" },
        border: { color: "#1E2A35" },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="logs-chart-panel">
      <SectionHeader>Daily Messages (30 Days)</SectionHeader>
      <div style={{ height: 200 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

// ─── User Table ───
function UserTable({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div>
      <SectionHeader>By User</SectionHeader>
      <table className="tbl">
        <thead>
          <tr>
            {["User", "Role", "Messages", "Tokens", "Avg. Duration"].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((u, i) => (
            <tr key={i}>
              <td>{u.user_name || u.user_phone || "\u2014"}</td>
              <td className="mono muted">{u.user_role || "\u2014"}</td>
              <td className="mono">{fmtNum(u.messages)}</td>
              <td className="mono" style={{ color: "var(--accent)" }}>{fmtNum(u.tokens)}</td>
              <td className="mono muted">{u.avg_ms ? `${fmtNum(u.avg_ms)}ms` : "\u2014"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Intent Table ───
function IntentTable({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div>
      <SectionHeader>Intent Distribution</SectionHeader>
      <table className="tbl">
        <thead>
          <tr>
            {["Intent", "Count", "Tokens"].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="mono">{row.intent || "\u2014"}</td>
              <td className="mono">{fmtNum(row.count)}</td>
              <td className="mono" style={{ color: "var(--accent)" }}>{fmtNum(row.tokens)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Model Usage Cards ───
function ModelUsageCards({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <SectionHeader>Model Usage</SectionHeader>
      <div className="logs-model-row">
        {data.map((m, i) => (
          <div key={i} className="logs-model-card">
            <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)", marginBottom: 4 }}>{m.model}</div>
            <div style={{ fontSize: 18, fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>{fmtNum(m.tokens)} token</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{fmtNum(m.calls)} calls</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Intent Badge ───
function IntentBadge({ intent, isCommand }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 3, fontSize: 10, fontFamily: '"DM Mono", monospace',
      background: isCommand ? "rgba(74,158,191,0.15)" : "rgba(200,169,122,0.15)",
      color: isCommand ? "var(--accent-2)" : "var(--accent)",
      border: `1px solid ${isCommand ? "rgba(74,158,191,0.3)" : "rgba(200,169,122,0.3)"}`,
    }}>
      {intent || "\u2014"}
    </span>
  );
}

// ─── Role Badge ───
function RoleBadge({ role }) {
  if (!role) return null;
  const colors = { ceo: "var(--accent)", manager: "var(--accent-2)", agent: "var(--text-secondary)" };
  return (
    <span style={{
      padding: "1px 6px", borderRadius: 3, fontSize: 9, fontFamily: '"DM Mono", monospace',
      background: "rgba(200,169,122,0.1)", color: colors[role] || "var(--text-secondary)",
      border: "1px solid rgba(200,169,122,0.2)", marginLeft: 8, textTransform: "uppercase",
      letterSpacing: 1,
    }}>
      {role}
    </span>
  );
}

// ─── Message Card ───
function MessageCard({ log }) {
  const hasError = !!log.error;
  const isClarification = log.intent === "clarification";
  const hasRewrite = log.rewritten_question && log.rewritten_question !== log.message_text;

  let borderLeft = "none";
  if (hasError) borderLeft = "3px solid var(--danger)";
  else if (isClarification) borderLeft = "3px solid var(--accent-2)";

  return (
    <div className="msg-card" style={{ borderLeft }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: "var(--text-secondary)" }}>
            {fmtTime(log.created_at)}
          </span>
          <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>|</span>
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
            {log.user_name || log.user_phone || "\u2014"}
          </span>
          <RoleBadge role={log.user_role} />
        </div>
        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: "var(--accent)" }}>
          {fmtNum(log.total_tokens)} tk
        </span>
      </div>

      {/* Separator */}
      <div className="msg-sep" />

      {/* Message */}
      <div style={{ marginBottom: 8 }}>
        <div className="msg-field-label">Message</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)" }}>
          {log.message_text || "\u2014"}
        </div>
      </div>

      {/* Rewrite */}
      <div style={{ marginBottom: 8 }}>
        <div className="msg-field-label">Rewrite</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: hasRewrite ? "var(--accent-2)" : "var(--text-secondary)" }}>
          {hasRewrite ? log.rewritten_question : "\u2014"}
        </div>
      </div>

      {/* Intent + Model row */}
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="msg-field-label" style={{ marginBottom: 0 }}>Intent</span>
          <IntentBadge intent={log.intent} isCommand={log.is_command} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="msg-field-label" style={{ marginBottom: 0 }}>Model</span>
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: "var(--text-primary)" }}>
            {log.model_intent || "\u2014"}
          </span>
        </div>
      </div>

      {/* Separator */}
      <div className="msg-sep" />

      {/* Response */}
      <div style={{ marginBottom: 4 }}>
        <div className="msg-field-label">Response</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
          {log.response_text || "\u2014"}
        </div>
      </div>

      {/* Separator */}
      <div className="msg-sep" />

      {/* Footer */}
      <div className="msg-footer">
        <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>
          <span>Duration: {log.duration_ms ? `${fmtNum(log.duration_ms)}ms` : "\u2014"}</span>
          <span>Tokens: {fmtNum(log.total_tokens)}</span>
          <span>Model: {log.model_intent || "\u2014"} &rarr; {log.model_answer || "\u2014"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {hasError && (
            <span style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: "var(--danger)" }}>
              Error: {log.error}
            </span>
          )}
          <CopyButton log={log} />
        </div>
      </div>
    </div>
  );
}

// ─── Filter Dropdown ───
function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="logs-filter-select"
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={typeof opt === "string" ? opt : opt.value} value={typeof opt === "string" ? opt : opt.value}>
          {typeof opt === "string" ? opt : opt.label}
        </option>
      ))}
    </select>
  );
}

// ─── Main Page ───
export default function LogsPage() {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("summary");

  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterIntent, setFilterIntent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateRange, setFilterDateRange] = useState("");

  // Dropdown options from summary
  const [userOptions, setUserOptions] = useState([]);
  const [intentOptions, setIntentOptions] = useState([]);

  const limit = 20;

  // Fetch summary
  useEffect(() => {
    fetch(`${API}/logs/summary?days=30`)
      .then(r => r.json())
      .then(data => {
        setSummary(data);
        // Extract distinct users and intents for filter dropdowns
        if (data.byUser) {
          setUserOptions(data.byUser.map(u => u.user_name).filter(Boolean));
        }
        if (data.byIntent) {
          setIntentOptions(data.byIntent.map(i => i.intent).filter(Boolean));
        }
      })
      .catch(console.error);
  }, []);

  // Fetch logs with filters
  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filterUser) params.set("user", filterUser);
    if (filterIntent) params.set("intent", filterIntent);
    if (filterStatus) params.set("status", filterStatus);
    if (filterDateRange) params.set("date_range", filterDateRange);

    fetch(`${API}/logs?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, filterUser, filterIntent, filterStatus, filterDateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterUser, filterIntent, filterStatus, filterDateRange]);

  const totalPages = Math.ceil(total / limit);

  const statusOptions = [
    { value: "success", label: "Success" },
    { value: "error", label: "Error" },
    { value: "clarification", label: "Clarification" },
  ];

  const dateRangeOptions = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
  ];

  return (
    <>
      <Head><title>ELIZA | Logs</title></Head>
      <style jsx>{`
        select option { background: var(--surface); color: var(--text-primary); }

        .logs-summary-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }
        .logs-summary-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px 16px;
          text-align: center;
        }
        .logs-chart-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 24px;
          margin-bottom: 32px;
        }
        .logs-doughnut-row {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .logs-model-row {
          display: flex;
          gap: 16px;
        }
        .logs-model-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 16px 20px;
        }
        .logs-tables-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        /* Message card */
        .msg-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 12px;
          position: relative;
        }
        .msg-sep {
          border-top: 1px solid var(--border);
          margin: 12px 0;
        }
        .msg-field-label {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }
        .msg-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* Filter dropdown */
        .logs-filter-select {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          padding: 8px 28px 8px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-primary);
          cursor: pointer;
          min-width: 140px;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235A7080'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
        }

        /* Tab switcher */
        .logs-tab {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 8px 20px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          font-weight: 400;
        }
        .logs-tab.active {
          background: var(--accent);
          color: var(--bg);
          font-weight: 600;
        }

        /* Filter bar */
        .logs-filter-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: center;
        }

        /* Pagination */
        .logs-page-btn {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          padding: 6px 16px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
        }
        .logs-page-btn:disabled {
          cursor: default;
        }

        /* Clear filters button */
        .logs-clear-btn {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          padding: 8px 14px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .logs-summary-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .logs-doughnut-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .logs-tables-grid {
            grid-template-columns: 1fr;
          }
          .logs-model-row {
            flex-wrap: wrap;
          }
          .logs-filter-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .logs-filter-select {
            min-width: unset;
            width: 100%;
          }
          .msg-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
        @media (max-width: 480px) {
          .logs-summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page">
        <Nav subtitle="Logs" />

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {[
            { key: "summary", label: "Summary" },
            { key: "messages", label: "Messages" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`logs-tab${tab === t.key ? " active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ SUMMARY TAB ═══ */}
        {tab === "summary" && summary && (
          <>
            {/* A) Summary Cards */}
            <SummaryCards data={summary.overall} />

            {/* B) Intent Routing Doughnut */}
            <IntentRoutingChart data={summary.byModelIntent} />

            {/* C) Daily Bar Chart */}
            <DailyChart data={summary.daily} />

            {/* D) User + Intent Tables side by side */}
            <div className="logs-tables-grid">
              <UserTable data={summary.byUser} />
              <IntentTable data={summary.byIntent} />
            </div>

            {/* E) Model Usage Cards */}
            <ModelUsageCards data={summary.byModel} />
          </>
        )}

        {/* ═══ MESSAGES TAB ═══ */}
        {tab === "messages" && (
          <>
            {/* Filter Bar */}
            <div className="logs-filter-bar">
              <FilterSelect
                value={filterUser}
                onChange={setFilterUser}
                options={userOptions}
                placeholder="All Users"
              />
              <FilterSelect
                value={filterIntent}
                onChange={setFilterIntent}
                options={intentOptions}
                placeholder="All Intents"
              />
              <FilterSelect
                value={filterStatus}
                onChange={setFilterStatus}
                options={statusOptions}
                placeholder="All Status"
              />
              <FilterSelect
                value={filterDateRange}
                onChange={setFilterDateRange}
                options={dateRangeOptions}
                placeholder="All Time"
              />
              {(filterUser || filterIntent || filterStatus || filterDateRange) && (
                <button
                  onClick={() => { setFilterUser(""); setFilterIntent(""); setFilterStatus(""); setFilterDateRange(""); }}
                  className="logs-clear-btn"
                >
                  Clear Filters
                </button>
              )}
              <div style={{ marginLeft: "auto", fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)" }}>
                {fmtNum(total)} results
              </div>
            </div>

            {/* Message Cards */}
            {loading ? (
              <div className="loading">Loading...</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', fontSize: 13 }}>
                No messages found.
              </div>
            ) : (
              <>
                {logs.map(log => (
                  <MessageCard key={log.id} log={log} />
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="logs-page-btn"
                      style={{ color: page === 1 ? "var(--border)" : "var(--text-secondary)" }}
                    >
                      {"\u2190"}
                    </button>
                    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: "var(--text-secondary)", alignSelf: "center" }}>
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="logs-page-btn"
                      style={{ color: page === totalPages ? "var(--border)" : "var(--text-secondary)" }}
                    >
                      {"\u2192"}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
