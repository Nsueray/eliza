import Head from "next/head";
import { useState, useEffect } from "react";
import Nav from "@/components/Nav";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const ROLE_COLORS = {
  ceo: "#C8A97A",
  manager: "#4A9EBF",
  agent: "#5A7080",
};

const SERVICES = [
  { name: "ELIZA API", url: "https://eliza-api-8tkr.onrender.com", healthPath: "/health" },
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
      <style jsx>{`
        .svc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }
        .svc-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px;
        }
        .svc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .svc-name {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 500;
        }
        .svc-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .svc-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .svc-dot.reachable { background: var(--success); }
        .svc-dot.unknown { background: var(--warning); }
        .svc-dot.checking { background: var(--text-secondary); }
        .svc-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .svc-label.reachable { color: var(--success); }
        .svc-label.unknown { color: var(--warning); }
        .svc-label.checking { color: var(--text-secondary); }
        .svc-url {
          font-size: 11px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          word-break: break-all;
        }
        .sync-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 16px;
        }
        .sync-label {
          font-size: 10px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .sync-val {
          font-size: 13px;
          font-family: var(--font-mono);
        }
        .sync-val.muted {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .role-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1px;
          padding: 3px 8px;
          border-radius: 3px;
          text-transform: uppercase;
          display: inline-block;
        }
        .error-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--danger);
          border-radius: var(--radius);
          padding: 12px 16px;
        }
        .error-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .error-user { font-size: 12px; font-weight: 500; }
        .error-date {
          font-size: 11px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }
        .error-msg {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .error-detail {
          font-size: 12px;
          color: var(--danger);
          font-family: var(--font-mono);
        }
        .no-errors {
          padding: 32px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--success);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .no-errors-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--success);
        }
        .no-errors-text {
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 1px;
        }
        .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
        }
        .empty-panel {
          padding: 32px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-secondary);
          text-align: center;
        }
      `}</style>

      <div className="page">
        <Nav subtitle="System" />

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* A) Services */}
            <div className="mb-32" style={{ marginTop: 8 }}>
              <div className="section-title mb-16">Services</div>
              <div className="svc-grid">
                {SERVICES.map(svc => {
                  const status = serviceStatus[svc.name];
                  const statusClass = status === "reachable" ? "reachable" : status === "unknown" ? "unknown" : "checking";
                  const statusLabel = status === "reachable" ? "Reachable" : status === "unknown" ? "Unknown" : "Checking...";

                  return (
                    <div key={svc.name} className="svc-card">
                      <div className="svc-header">
                        <span className="svc-name">{svc.name}</span>
                        <div className="svc-status">
                          <span className={`svc-dot ${statusClass}`} />
                          <span className={`svc-label ${statusClass}`}>{statusLabel}</span>
                        </div>
                      </div>
                      <div className="svc-url">{svc.url}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* B) Database Tables */}
            <div className="mb-32">
              <div className="section-title mb-16">
                Database Tables {sortedTables.length > 0 && `(${sortedTables.length} tables)`}
              </div>
              {sortedTables.length > 0 ? (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Table Name</th>
                      <th className="r">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTables.map((t, i) => (
                      <tr key={i}>
                        <td className="mono">{t.relname}</td>
                        <td className="mono r text-accent">{fmtNum(t.n_live_tup)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-panel">No table data available</div>
              )}
            </div>

            {/* C) Last Sync */}
            <div className="mb-32">
              <div className="section-title mb-16">Last Sync</div>
              {systemData?.last_sync ? (
                <div className="panel">
                  <div className="sync-grid">
                    <div>
                      <div className="sync-label">Sync Type</div>
                      <div className="sync-val">{systemData.last_sync.sync_type || "\u2014"}</div>
                    </div>
                    <div>
                      <div className="sync-label">Module</div>
                      <div className="sync-val">{systemData.last_sync.module || "\u2014"}</div>
                    </div>
                    <div>
                      <div className="sync-label">Started</div>
                      <div className="sync-val muted">{fmtDate(systemData.last_sync.started_at)}</div>
                    </div>
                    <div>
                      <div className="sync-label">Completed</div>
                      <div className="sync-val muted">{fmtDate(systemData.last_sync.completed_at)}</div>
                    </div>
                    <div>
                      <div className="sync-label">Records</div>
                      <div className="sync-val text-accent">{fmtNum(systemData.last_sync.records_synced)}</div>
                    </div>
                    <div>
                      <div className="sync-label">Status</div>
                      <div>
                        <span className={`badge ${systemData.last_sync.status === "completed" ? "badge-success" : "badge-danger"}`} style={{ textTransform: "uppercase" }}>
                          {systemData.last_sync.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-panel">No sync records found</div>
              )}
            </div>

            {/* D) Active Users */}
            <div className="mb-32">
              <div className="section-title mb-16">
                Active Users {systemData?.users && `(${systemData.users.length})`}
              </div>
              {systemData?.users?.length > 0 ? (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Last Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemData.users.map((u, i) => {
                      const roleColor = ROLE_COLORS[u.role] || "var(--text-secondary)";
                      return (
                        <tr key={i}>
                          <td>{u.name}</td>
                          <td>
                            <span
                              className="role-badge"
                              style={{
                                color: roleColor,
                                background: `${roleColor}15`,
                                border: `1px solid ${roleColor}40`,
                              }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="mono text-muted text-sm">
                            {u.last_message ? fmtDate(u.last_message) : "Never"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-panel">No active users</div>
              )}
            </div>

            {/* E) Recent Errors */}
            <div className="mb-32">
              <div className="section-title mb-16">Recent Errors</div>
              {systemData?.recent_errors?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {systemData.recent_errors.map((err, i) => (
                    <div key={i} className="error-card">
                      <div className="error-header">
                        <span className="error-user">{err.user_name || "Unknown"}</span>
                        <span className="error-date">{fmtDate(err.created_at)}</span>
                      </div>
                      <div className="error-msg">{truncate(err.message_text, 50)}</div>
                      <div className="error-detail">{err.error}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-errors">
                  <span className="no-errors-dot" />
                  <span className="no-errors-text">No recent errors</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
