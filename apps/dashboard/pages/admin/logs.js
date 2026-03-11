import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

function fmtNum(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function truncate(str, max = 60) {
  if (!str) return "—";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// Summary cards component
function SummaryCards({ data }) {
  if (!data) return null;
  const cards = [
    { label: "Total Messages", value: fmtNum(data.total_messages), icon: "💬" },
    { label: "Active Users", value: fmtNum(data.unique_users), icon: "👤" },
    { label: "Total Tokens", value: fmtNum(data.total_tokens), icon: "🔤" },
    { label: "Avg. Duration", value: data.avg_duration_ms ? `${fmtNum(data.avg_duration_ms)}ms` : "—", icon: "⏱️" },
    { label: "Errors", value: fmtNum(data.error_count), icon: "⚠️" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "20px 16px",
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
          <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 22, fontWeight: 500, color: "var(--accent)" }}>{c.value}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4, fontFamily: '"DM Mono", monospace' }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// User table component
function UserTable({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
        By User
      </div>
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
                {u.user_name || u.user_phone || "—"}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>
                {u.user_role || "—"}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontFamily: '"DM Mono", monospace' }}>
                {fmtNum(u.messages)}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>
                {fmtNum(u.tokens)}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>
                {u.avg_ms ? `${fmtNum(u.avg_ms)}ms` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Intent table component
function IntentTable({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
        Intent Distribution
      </div>
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
                {row.intent || "—"}
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

// Message log detail row
function LogRow({ log, expanded, onToggle }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace' }}>
          {fmtDate(log.created_at)}
        </td>
        <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
          {log.user_name || log.user_phone || "—"}
        </td>
        <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
          {truncate(log.message_text, 50)}
        </td>
        <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, fontFamily: '"DM Mono", monospace' }}>
          <span style={{
            padding: "2px 8px", borderRadius: 3, fontSize: 10,
            background: log.is_command ? "rgba(74,158,191,0.15)" : "rgba(200,169,122,0.15)",
            color: log.is_command ? "var(--accent-2)" : "var(--accent)",
            border: `1px solid ${log.is_command ? "rgba(74,158,191,0.3)" : "rgba(200,169,122,0.3)"}`,
          }}>
            {log.intent || "—"}
          </span>
        </td>
        <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>
          {fmtNum(log.total_tokens)}
        </td>
        <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>
          {log.duration_ms ? `${fmtNum(log.duration_ms)}ms` : "—"}
        </td>
        <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
          {log.error ? "❌" : "✅"}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: "16px 24px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, marginBottom: 6 }}>MESSAGE</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
                  {log.message_text || "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, marginBottom: 6 }}>RESPONSE</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
                  {log.response_text || "—"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 11, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace' }}>
              <span>Intent: {log.model_intent || "—"}</span>
              <span>Answer: {log.model_answer || "—"}</span>
              <span>Input: {fmtNum(log.input_tokens)}</span>
              <span>Output: {fmtNum(log.output_tokens)}</span>
              {log.error && <span style={{ color: "var(--danger)" }}>Error: {log.error}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogsPage() {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [tab, setTab] = useState("summary"); // summary | messages

  useEffect(() => {
    fetch(`${API}/logs/summary?days=30`)
      .then(r => r.json())
      .then(setSummary)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/logs?page=${page}&limit=30`)
      .then(r => r.json())
      .then(data => { setLogs(data.logs || []); setTotal(data.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 30);

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
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 24, borderBottom: "1px solid var(--accent)", marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 28, fontWeight: 500, letterSpacing: 6 }}>
              ELIZA<span style={{ color: "var(--accent)" }}>.</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>Message Logs</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/admin" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>
              Admin →
            </Link>
            <Link href="/" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>
              War Room →
            </Link>
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

        {/* Summary Tab */}
        {tab === "summary" && summary && (
          <>
            <SummaryCards data={summary.overall} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <UserTable data={summary.byUser} />
              <IntentTable data={summary.byIntent} />
            </div>
            {summary.byModel && summary.byModel.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
                  Model Usage
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  {summary.byModel.map((m, i) => (
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
            )}
          </>
        )}

        {/* Messages Tab */}
        {tab === "messages" && (
          <>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>Loading...</div>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
                  <thead>
                    <tr>
                      {["Date", "User", "Message", "Intent", "Tokens", "Duration", ""].map(h => (
                        <th key={h} style={{
                          fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)",
                          letterSpacing: 1.5, textTransform: "uppercase", textAlign: "left",
                          padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <LogRow
                        key={log.id}
                        log={log}
                        expanded={expandedId === log.id}
                        onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      />
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      style={{
                        fontFamily: '"DM Mono", monospace', fontSize: 11, padding: "6px 16px",
                        border: "1px solid var(--border)", borderRadius: 4, background: "transparent",
                        color: page === 1 ? "var(--border)" : "var(--text-secondary)", cursor: page === 1 ? "default" : "pointer",
                      }}
                    >
                      ←
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
                        color: page === totalPages ? "var(--border)" : "var(--text-secondary)", cursor: page === totalPages ? "default" : "pointer",
                      }}
                    >
                      →
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
