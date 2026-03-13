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

const ROLE_COLORS = {
  ceo: "#C8A97A",
  manager: "#4A9EBF",
  agent: "#5A7080",
};

const SERVICES = [
  { name: "ELIZA API", url: "https://eliza-api-8tkr.onrender.com", healthPath: "/api/health" },
  { name: "ELIZA Bot", url: "https://eliza-bot-r1vx.onrender.com", healthPath: "/health" },
  { name: "ELIZA Dashboard", url: "https://eliza.elanfairs.com", healthPath: "/" },
];

function fmtNum(n) {
  if (n == null) return "\u2014";
  return Number(n).toLocaleString("en-US");
}

function fmtDate(d) {
  if (!d) return "\u2014";
  const dt = new Date(d);
  return dt.toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function truncate(str, max = 50) {
  if (!str) return "\u2014";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

export default function SystemPage() {
  const [systemData, setSystemData] = useState(null);
  const [serviceStatus, setServiceStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/system/status`)
      .then(r => r.json())
      .then(data => { setSystemData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    SERVICES.forEach(svc => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      fetch(svc.url + svc.healthPath, { mode: "no-cors", signal: controller.signal })
        .then(() => {
          setServiceStatus(prev => ({ ...prev, [svc.name]: "reachable" }));
        })
        .catch(() => {
          setServiceStatus(prev => ({ ...prev, [svc.name]: "unknown" }));
        })
        .finally(() => clearTimeout(timeout));
    });
  }, []);

  const sortedTables = systemData?.tables
    ? [...systemData.tables].sort((a, b) => (parseInt(b.n_live_tup) || 0) - (parseInt(a.n_live_tup) || 0))
    : [];

  return (
    <>
      <Head><title>ELIZA | System</title></Head>
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
            <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>System Status</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/admin/logs" style={navStyle}>Logs</Link>
            <Link href="/admin/intelligence" style={navStyle}>Intelligence</Link>
            <Link href="/admin/system" style={activeNavStyle}>System</Link>
            <Link href="/admin" style={navStyle}>Users</Link>
            <Link href="/" style={navStyle}>War Room &rarr;</Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>Loading...</div>
        ) : (
          <>
            {/* A) Services */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>Services</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                {SERVICES.map(svc => {
                  const status = serviceStatus[svc.name];
                  const statusColor = status === "reachable" ? "var(--success)" : status === "unknown" ? "var(--warning)" : "var(--text-secondary)";
                  const statusLabel = status === "reachable" ? "Reachable" : status === "unknown" ? "Unknown" : "Checking...";

                  return (
                    <div key={svc.name} style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: 16,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 13, fontWeight: 500 }}>
                          {svc.name}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: statusColor,
                          }} />
                          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: statusColor, letterSpacing: 1, textTransform: "uppercase" }}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', wordBreak: "break-all" }}>
                        {svc.url}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* B) Database Tables */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>
                Database Tables {sortedTables.length > 0 && `(${sortedTables.length} tables)`}
              </div>
              {sortedTables.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Table Name</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTables.map((t, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, fontFamily: '"DM Mono", monospace', fontSize: 12 }}>
                          {t.relname}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>
                          {fmtNum(t.n_live_tup)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", textAlign: "center" }}>
                  No table data available
                </div>
              )}
            </div>

            {/* C) Last Sync */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>Last Sync</div>
              {systemData?.last_sync ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Sync Type</div>
                      <div style={{ fontSize: 13, fontFamily: '"DM Mono", monospace' }}>{systemData.last_sync.sync_type || "\u2014"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Module</div>
                      <div style={{ fontSize: 13, fontFamily: '"DM Mono", monospace' }}>{systemData.last_sync.module || "\u2014"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Started</div>
                      <div style={{ fontSize: 12, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>{fmtDate(systemData.last_sync.started_at)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Completed</div>
                      <div style={{ fontSize: 12, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>{fmtDate(systemData.last_sync.completed_at)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Records</div>
                      <div style={{ fontSize: 13, fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>{fmtNum(systemData.last_sync.records_synced)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace', letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Status</div>
                      <div>
                        <span style={{
                          fontFamily: '"DM Mono", monospace',
                          fontSize: 10,
                          letterSpacing: 1,
                          padding: "3px 8px",
                          borderRadius: 3,
                          color: systemData.last_sync.status === "completed" ? "var(--success)" : "var(--danger)",
                          background: systemData.last_sync.status === "completed" ? "rgba(46,204,113,0.1)" : "rgba(192,57,43,0.1)",
                          border: `1px solid ${systemData.last_sync.status === "completed" ? "rgba(46,204,113,0.3)" : "rgba(192,57,43,0.3)"}`,
                          textTransform: "uppercase",
                        }}>
                          {systemData.last_sync.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", textAlign: "center" }}>
                  No sync records found
                </div>
              )}
            </div>

            {/* D) Active Users */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>
                Active Users {systemData?.users && `(${systemData.users.length})`}
              </div>
              {systemData?.users?.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Last Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemData.users.map((u, i) => {
                      const roleColor = ROLE_COLORS[u.role] || "var(--text-secondary)";
                      return (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontSize: 13 }}>{u.name}</td>
                          <td style={tdStyle}>
                            <span style={{
                              fontFamily: '"DM Mono", monospace',
                              fontSize: 10,
                              fontWeight: 500,
                              letterSpacing: 1,
                              padding: "3px 8px",
                              borderRadius: 3,
                              color: roleColor,
                              background: `${roleColor}15`,
                              border: `1px solid ${roleColor}40`,
                              textTransform: "uppercase",
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)" }}>
                            {u.last_message ? fmtDate(u.last_message) : "Never"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", textAlign: "center" }}>
                  No active users
                </div>
              )}
            </div>

            {/* E) Recent Errors */}
            <div style={{ marginBottom: 48 }}>
              <div style={sectionHeader}>Recent Errors</div>
              {systemData?.recent_errors?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {systemData.recent_errors.map((err, i) => (
                    <div key={i} style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderLeft: "3px solid var(--danger)",
                      borderRadius: 4,
                      padding: "12px 16px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>
                          {err.user_name || "Unknown"}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace' }}>
                          {fmtDate(err.created_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {truncate(err.message_text, 50)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--danger)", fontFamily: '"DM Mono", monospace' }}>
                        {err.error}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: 32,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--success)",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}>
                  <span style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--success)",
                  }} />
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, letterSpacing: 1 }}>
                    No recent errors
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
