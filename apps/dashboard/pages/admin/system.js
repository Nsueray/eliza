import Head from "next/head";
import { useState, useEffect, useRef, useCallback } from "react";
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

function fmtShortDate(d) {
  if (!d) return "\u2014";
  const dt = new Date(d);
  return dt.toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(started, completed) {
  if (!started || !completed) return "\u2014";
  const ms = new Date(completed) - new Date(started);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(str, max = 50) {
  if (!str) return "\u2014";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

function timeAgo(d) {
  if (!d) return "never";
  const ms = Date.now() - new Date(d).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Export helpers ──
function syncToTSV(syncs) {
  const headers = ["Time", "Type", "Module", "Records", "Updated", "Duration", "Status", "Error"];
  const rows = syncs.map(s => [
    fmtShortDate(s.started_at),
    s.sync_type || "",
    s.module || "",
    s.records_synced ?? 0,
    s.records_updated ?? 0,
    fmtDuration(s.started_at, s.completed_at),
    s.status || "",
    s.error_message || "",
  ]);
  return [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SystemPage() {
  const [systemData, setSystemData] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const [serviceStatus, setServiceStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncBtnState, setSyncBtnState] = useState("idle"); // idle | syncing | success
  const [expandedRow, setExpandedRow] = useState(null);
  const [exportFeedback, setExportFeedback] = useState(null);
  const intervalRef = useRef(null);

  const fetchSyncStatus = useCallback(() => {
    fetch(`${API}/system/sync-status`)
      .then(r => r.json())
      .then(data => {
        setSyncData(data);
        setLastUpdated(new Date());
      })
      .catch(() => {});
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([
      fetch(`${API}/system/status`).then(r => r.json()),
      fetch(`${API}/system/sync-status`).then(r => r.json()),
    ]).then(([sys, sync]) => {
      setSystemData(sys);
      setSyncData(sync);
      setLastUpdated(new Date());
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Service health checks
  useEffect(() => {
    SERVICES.forEach(svc => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      fetch(svc.url + svc.healthPath, { mode: "no-cors", signal: controller.signal })
        .then(() => setServiceStatus(prev => ({ ...prev, [svc.name]: "reachable" })))
        .catch(() => setServiceStatus(prev => ({ ...prev, [svc.name]: "unknown" })))
        .finally(() => clearTimeout(timeout));
    });
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSyncStatus, 30000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchSyncStatus]);

  async function triggerSync(type = "incremental") {
    setSyncBtnState("syncing");
    try {
      await fetch(`${API}/system/sync-now?type=${type}`, { method: "POST" });
      // Wait 5s then refresh
      setTimeout(() => {
        fetchSyncStatus();
        setSyncBtnState("success");
        setTimeout(() => setSyncBtnState("idle"), 3000);
      }, 5000);
    } catch {
      setSyncBtnState("idle");
    }
  }

  function handleCopy() {
    if (!syncData?.syncs) return;
    navigator.clipboard.writeText(syncToTSV(syncData.syncs));
    setExportFeedback("Copied!");
    setTimeout(() => setExportFeedback(null), 2000);
  }

  function handleCSV() {
    if (!syncData?.syncs) return;
    downloadFile(syncToTSV(syncData.syncs).replace(/\t/g, ","), "sync_log.csv", "text/csv");
    setExportFeedback("CSV saved");
    setTimeout(() => setExportFeedback(null), 2000);
  }

  async function handleExcel() {
    if (!syncData?.syncs) return;
    try {
      if (!window.XLSX) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const headers = ["Time", "Type", "Module", "Records", "Updated", "Duration", "Status", "Error"];
      const rows = syncData.syncs.map(s => [
        fmtShortDate(s.started_at), s.sync_type, s.module,
        s.records_synced ?? 0, s.records_updated ?? 0,
        fmtDuration(s.started_at, s.completed_at), s.status, s.error_message || "",
      ]);
      const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Sync Log");
      window.XLSX.writeFile(wb, "sync_log.xlsx");
      setExportFeedback("Excel saved");
      setTimeout(() => setExportFeedback(null), 2000);
    } catch {
      handleCSV(); // fallback
    }
  }

  const summary = syncData?.summary || {};
  const syncs = syncData?.syncs || [];

  const sortedTables = systemData?.tables
    ? [...systemData.tables].sort((a, b) => (parseInt(b.n_live_tup) || 0) - (parseInt(a.n_live_tup) || 0))
    : [];

  return (
    <>
      <Head><title>ELIZA | System</title></Head>
      <style jsx global>{`
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
          box-shadow: var(--card-shadow);
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
          box-shadow: var(--card-shadow);
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
          box-shadow: var(--card-shadow);
        }
        .empty-panel {
          padding: 32px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-secondary);
          text-align: center;
        }

        /* Sync Dashboard */
        .sync-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .sync-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
        }
        .auto-refresh-toggle input {
          accent-color: var(--accent);
        }
        .last-updated {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
          letter-spacing: 0.5px;
        }
        .sync-btn {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 10px 24px;
          border: 1px solid var(--accent);
          background: var(--accent);
          color: var(--bg);
          cursor: pointer;
          border-radius: var(--radius);
          transition: all 0.2s;
          font-weight: 500;
          min-width: 140px;
          text-align: center;
        }
        .sync-btn:hover { opacity: 0.85; }
        .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sync-btn.syncing {
          background: var(--surface);
          color: var(--accent);
          border-color: var(--accent);
        }
        .sync-btn.success {
          background: var(--success);
          border-color: var(--success);
          color: #fff;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid var(--accent);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-right: 6px;
          vertical-align: middle;
        }
        .sync-type-select {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          cursor: pointer;
        }
        .sync-error-expand {
          margin-top: 8px;
          padding: 10px 14px;
          background: var(--surface-2);
          border: 1px solid rgba(192,57,43,0.2);
          border-radius: var(--radius);
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--danger);
          word-break: break-all;
        }
        .sync-row-clickable {
          cursor: pointer;
        }
        .sync-row-clickable:hover td {
          background: var(--row-hover);
        }
      `}</style>

      <div className="page">
        <Nav subtitle="System" />

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* ═══ A) SYNC DASHBOARD ═══ */}
            <div className="mb-32" style={{ marginTop: 8 }}>
              <div className="sync-header-row">
                <div className="section-title">Sync Dashboard</div>
                <div className="sync-controls">
                  <span className="last-updated">
                    Updated: {lastUpdated ? timeAgo(lastUpdated) : "\u2014"}
                  </span>
                  <label className="auto-refresh-toggle">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={() => setAutoRefresh(p => !p)}
                    />
                    Auto-refresh {autoRefresh ? "ON" : "OFF"}
                  </label>
                </div>
              </div>

              {/* Summary cards */}
              <div className="summary-row cols-3" style={{ marginBottom: 20 }}>
                <div className="summary-card">
                  <div className="summary-label">Last Sync</div>
                  <div className="summary-val" style={{ fontSize: 20 }}>
                    {summary.last_sync_ago || "Never"}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Records Today</div>
                  <div className="summary-val" style={{ fontSize: 20 }}>
                    {fmtNum(summary.records_today || 0)}
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 8, fontWeight: 400 }}>
                      ({summary.total_syncs_today || 0} syncs)
                    </span>
                  </div>
                </div>
                <div className="summary-card" style={{
                  borderLeftColor: summary.is_active ? "var(--success)" : "var(--danger)",
                }}>
                  <div className="summary-label">Scheduler</div>
                  <div className="summary-val" style={{ fontSize: 20 }}>
                    <span style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: summary.is_active ? "var(--success)" : "var(--danger)",
                      marginRight: 8,
                      verticalAlign: "middle",
                    }} />
                    <span style={{ color: summary.is_active ? "var(--success)" : "var(--danger)" }}>
                      {summary.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Now button row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <button
                  className={`sync-btn ${syncBtnState}`}
                  disabled={syncBtnState === "syncing"}
                  onClick={() => triggerSync(document.getElementById("syncTypeSelect")?.value || "incremental")}
                >
                  {syncBtnState === "syncing" && <span className="spinner" />}
                  {syncBtnState === "idle" && "Sync Now"}
                  {syncBtnState === "syncing" && "Syncing..."}
                  {syncBtnState === "success" && "\u2713 Synced"}
                </button>
                <select id="syncTypeSelect" className="sync-type-select" defaultValue="incremental">
                  <option value="incremental">Incremental</option>
                  <option value="full">Full</option>
                </select>
              </div>

              {/* Sync log table */}
              <div className="flex-between mb-16">
                <div className="section-title" style={{ fontSize: 11, letterSpacing: 2 }}>
                  Sync Log ({syncs.length} entries)
                </div>
                <div className="export-bar">
                  <button className="btn-sm" onClick={handleCopy}>Copy</button>
                  <button className="btn-sm" onClick={handleCSV}>CSV</button>
                  <button className="btn-sm" onClick={handleExcel}>Excel</button>
                  {exportFeedback && <span className="export-feedback">{exportFeedback}</span>}
                </div>
              </div>

              {syncs.length > 0 ? (
                <table className="tbl">
                  <thead>
                    <tr>
                      {["Time", "Type", "Module", "Records", "Updated", "Duration", "Status"].map(h => (
                        <th key={h} className={["Records", "Updated", "Duration"].includes(h) ? "r" : ""}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {syncs.flatMap(s => {
                      const hasError = s.status === "error" && s.error_message;
                      const isExpanded = expandedRow === s.id;
                      const rows = [
                        <tr
                          key={s.id}
                          className={hasError ? "sync-row-clickable" : ""}
                          onClick={() => hasError && setExpandedRow(isExpanded ? null : s.id)}
                        >
                          <td className="mono" style={{ fontSize: 12 }}>{fmtShortDate(s.started_at)}</td>
                          <td>
                            <span className={`badge ${s.sync_type === "full" ? "badge-accent" : "badge-blue"}`}>
                              {s.sync_type || "\u2014"}
                            </span>
                          </td>
                          <td>
                            <span className="badge" style={{
                              color: "var(--text-secondary)",
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                            }}>
                              {s.module || "\u2014"}
                            </span>
                          </td>
                          <td className="mono r text-accent">{fmtNum(s.records_synced)}</td>
                          <td className="mono r text-accent">{fmtNum(s.records_updated)}</td>
                          <td className="mono r text-muted" style={{ fontSize: 12 }}>{fmtDuration(s.started_at, s.completed_at)}</td>
                          <td>
                            <span className={`badge ${s.status === "success" ? "badge-success" : s.status === "running" ? "badge-warning" : "badge-danger"}`} style={{ textTransform: "uppercase" }}>
                              {s.status}
                            </span>
                            {hasError && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-secondary)" }}>
                                {isExpanded ? "\u25B2" : "\u25BC"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ];
                      if (isExpanded) {
                        rows.push(
                          <tr key={`${s.id}-err`}>
                            <td colSpan={7} style={{ padding: "0 16px 12px 16px" }}>
                              <div className="sync-error-expand">{s.error_message}</div>
                            </td>
                          </tr>
                        );
                      }
                      return rows;
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-panel">No sync records found</div>
              )}
            </div>

            {/* ═══ B) SERVICES ═══ */}
            <div className="mb-32">
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

            {/* ═══ C) DATABASE TABLES ═══ */}
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

            {/* ═══ D) ACTIVE USERS ═══ */}
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

            {/* ═══ E) RECENT ERRORS ═══ */}
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
