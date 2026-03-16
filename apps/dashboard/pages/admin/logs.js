import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 32 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "20px 16px",
          textAlign: "center",
        }}>
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
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
      padding: 24, marginBottom: 32,
    }}>
      <SectionHeader>Intent Routing</SectionHeader>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
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
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
      padding: 24, marginBottom: 32,
    }}>
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
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
        <thead>
          <tr>
            {["User", "Role", "Messages", "Tokens", "Avg. Duration"].map(h => (
              <th key={h} style={{
                fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)",
                letterSpacing: 1.5, textTransform: "uppercase", textAlign: "left",
                padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((u, i) => (
            <tr key={i}>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                {u.user_name || u.user_phone || "\u2014"}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>
                {u.user_role || "\u2014"}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontFamily: '"DM Mono", monospace' }}>
                {fmtNum(u.messages)}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>
                {fmtNum(u.tokens)}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>
                {u.avg_ms ? `${fmtNum(u.avg_ms)}ms` : "\u2014"}
              </td>
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
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
        <thead>
          <tr>
            {["Intent", "Count", "Tokens"].map(h => (
              <th key={h} style={{
                fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)",
                letterSpacing: 1.5, textTransform: "uppercase", textAlign: "left",
                padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontFamily: '"DM Mono", monospace' }}>
                {row.intent || "\u2014"}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontFamily: '"DM Mono", monospace' }}>
                {fmtNum(row.count)}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>
                {fmtNum(row.tokens)}
              </td>
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
      <div style={{ display: "flex", gap: 16 }}>
        {data.map((m, i) => (
          <div key={i} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 20px",
          }}>
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
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
      padding: 20, marginBottom: 12, borderLeft, position: "relative",
    }}>
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
      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      {/* Message */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Message
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)" }}>
          {log.message_text || "\u2014"}
        </div>
      </div>

      {/* Rewrite */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Rewrite
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: hasRewrite ? "var(--accent-2)" : "var(--text-secondary)" }}>
          {hasRewrite ? log.rewritten_question : "\u2014"}
        </div>
      </div>

      {/* Intent + Model row */}
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
            Intent
          </span>
          <IntentBadge intent={log.intent} isCommand={log.is_command} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
            Model
          </span>
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: "var(--text-primary)" }}>
            {log.model_intent || "\u2014"}
          </span>
        </div>
      </div>

      {/* Separator */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      {/* Response */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Response
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
          {log.response_text || "\u2014"}
        </div>
      </div>

      {/* Separator */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
      style={{
        fontFamily: '"DM Mono", monospace', fontSize: 11, padding: "8px 12px",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4,
        color: "var(--text-primary)", cursor: "pointer", minWidth: 140,
        appearance: "none", WebkitAppearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235A7080'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
        paddingRight: 28,
      }}
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

  const navLinks = [
    { href: "/admin/logs", label: "Logs", active: true },
    { href: "/admin/intelligence", label: "Intelligence", active: false },
    { href: "/admin/system", label: "System", active: false },
    { href: "/admin", label: "Users", active: false },
    { href: "/", label: "War Room \u2192", active: false },
    { href: "/sales", label: "Sales", active: false },
  ];

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
      <style jsx global>{`
        :root {
          --bg: #080B10; --surface: #0E1318; --surface-2: #141B22;
          --border: #1E2A35; --text-primary: #E8EDF2; --text-secondary: #5A7080;
          --accent: #C8A97A; --accent-2: #4A9EBF;
          --danger: #C0392B; --warning: #D4A017; --success: #2ECC71;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--bg); color: var(--text-primary); font-family: "DM Sans", -apple-system, sans-serif; min-height: 100vh; }
        select option { background: var(--surface); color: var(--text-primary); }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 48px" }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          paddingBottom: 24, borderBottom: "1px solid var(--accent)", marginBottom: 32,
        }}>
          <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 28, fontWeight: 500, letterSpacing: 6 }}>
            ELIZA<span style={{ color: "var(--accent)" }}>.</span>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2,
                  textTransform: "uppercase", textDecoration: "none",
                  color: link.active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {[
            { key: "summary", label: "Summary" },
            { key: "messages", label: "Messages" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
                padding: "8px 20px", border: "1px solid var(--border)", borderRadius: 4,
                background: tab === t.key ? "var(--accent)" : "transparent",
                color: tab === t.key ? "var(--bg)" : "var(--text-secondary)",
                cursor: "pointer", fontWeight: tab === t.key ? 600 : 400,
              }}
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
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
            <div style={{
              display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center",
            }}>
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
                  style={{
                    fontFamily: '"DM Mono", monospace', fontSize: 10, padding: "8px 14px",
                    border: "1px solid var(--border)", borderRadius: 4, background: "transparent",
                    color: "var(--text-secondary)", cursor: "pointer", letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
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
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>Loading...</div>
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
                      style={{
                        fontFamily: '"DM Mono", monospace', fontSize: 11, padding: "6px 16px",
                        border: "1px solid var(--border)", borderRadius: 4, background: "transparent",
                        color: page === 1 ? "var(--border)" : "var(--text-secondary)",
                        cursor: page === 1 ? "default" : "pointer",
                      }}
                    >
                      \u2190
                    </button>
                    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: "var(--text-secondary)", alignSelf: "center" }}>
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      style={{
                        fontFamily: '"DM Mono", monospace', fontSize: 11, padding: "6px 16px",
                        border: "1px solid var(--border)", borderRadius: 4, background: "transparent",
                        color: page === totalPages ? "var(--border)" : "var(--text-secondary)",
                        cursor: page === totalPages ? "default" : "pointer",
                      }}
                    >
                      \u2192
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
