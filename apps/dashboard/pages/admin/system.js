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
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtShortDate(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
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
    fmtShortDate(s.started_at), s.sync_type || "", s.module || "",
    s.records_synced ?? 0, s.records_updated ?? 0,
    fmtDuration(s.started_at, s.completed_at), s.status || "", s.error_message || "",
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
  const [syncBtnState, setSyncBtnState] = useState("idle");
  const [expandedRow, setExpandedRow] = useState(null);
  const [exportFeedback, setExportFeedback] = useState(null);
  const [, setTick] = useState(0);
  const intervalRef = useRef(null);
  const tickRef = useRef(null);

  const fetchSyncStatus = useCallback(() => {
    fetch(`${API}/system/sync-status`)
      .then(r => r.json())
      .then(data => { setSyncData(data); setLastUpdated(new Date()); })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSyncStatus, 30000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchSyncStatus]);

  // Tick every 5s to keep "Updated: X ago" display fresh between fetches
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 5000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  async function triggerSync(type = "incremental") {
    setSyncBtnState("syncing");
    try {
      await fetch(`${API}/system/sync-now?type=${type}`, { method: "POST" });
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
      handleCSV();
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
        /* ── Service cards (system page only) ── */
        .svc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
        .svc-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--card-shadow); }
        .svc-url { font-size: 11px; color: var(--text-secondary); font-family: var(--font-mono); word-break: break-all; }

        /* ── Sync button states ── */
        .sync-btn { min-width: 140px; text-align: center; }
        .sync-btn.syncing { background: var(--surface); color: var(--accent); border-color: var(--accent); }
        .sync-btn.success { background: var(--success); border-color: var(--success); color: #fff; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--accent); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 6px; vertical-align: middle; }

        /* ── Auto-refresh toggle ── */
        .auto-refresh-toggle { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-secondary); cursor: pointer; user-select: none; }
        .auto-refresh-toggle input { accent-color: var(--accent); }

        /* ── Sync type select ── */
        .sync-type-select { font-family: var(--font-mono); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 4px 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); cursor: pointer; }

        /* ── Expandable error row ── */
        .sync-error-expand { margin-top: 8px; padding: 10px 14px; background: var(--surface-2); border: 1px solid rgba(192,57,43,0.2); border-radius: var(--radius); font-family: var(--font-mono); font-size: 11px; color: var(--danger); word-break: break-all; }
        .sync-row-clickable { cursor: pointer; }

        /* ── Error cards ── */
        .error-card { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--danger); border-radius: var(--radius); padding: 12px 16px; box-shadow: var(--card-shadow); }

        /* ── No-errors panel ── */
        .no-errors { padding: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); color: var(--success); text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .no-errors-text { font-family: var(--font-mono); font-size: 12px; letter-spacing: 1px; }
      `}</style>

      <div className="page">
        <Nav subtitle="System" />

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* ═══ A) SYNC DASHBOARD ═══ */}
            <div className="mb-32 mt-8">
              <div className="flex-between mb-16">
                <div className="section-title">Sync Dashboard</div>
                <div className="flex-center gap-16">
                  <span className="text-mono text-xs text-muted">
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
              <div className="summary-row cols-3 mb-20">
                <div className="summary-card">
                  <div className="summary-label">Last Sync</div>
                  <div className="summary-val summary-val-sm">
                    {summary.last_sync_ago || "Never"}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Records Today</div>
                  <div className="summary-val summary-val-sm">
                    {fmtNum(summary.records_today || 0)}
                    <span className="summary-sub">
                      ({summary.total_syncs_today || 0} syncs)
                    </span>
                  </div>
                </div>
                <div className={`summary-card ${summary.is_active ? "summary-card-success" : "summary-card-danger"}`}>
                  <div className="summary-label">Scheduler</div>
                  <div className="summary-val summary-val-sm">
                    <span className={`status-dot ${summary.is_active ? "status-dot-success" : "status-dot-danger"}`} />
                    {" "}
                    <span className={summary.is_active ? "text-success" : "text-danger"}>
                      {summary.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Now button row */}
              <div className="flex-center gap-12 mb-20">
                <button
                  className={`btn-primary sync-btn ${syncBtnState}`}
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
                <div className="section-title text-xs">
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
                          <td className="mono text-sm">{fmtShortDate(s.started_at)}</td>
                          <td>
                            <span className={`badge ${s.sync_type === "full" ? "badge-accent" : "badge-blue"}`}>
                              {s.sync_type || "\u2014"}
                            </span>
                          </td>
                          <td>
                            <span className="badge">{s.module || "\u2014"}</span>
                          </td>
                          <td className="mono r text-accent">{fmtNum(s.records_synced)}</td>
                          <td className="mono r text-accent">{fmtNum(s.records_updated)}</td>
                          <td className="mono r text-muted text-sm">{fmtDuration(s.started_at, s.completed_at)}</td>
                          <td>
                            <span className={`badge text-upper ${s.status === "success" ? "badge-success" : s.status === "running" ? "badge-warning" : "badge-danger"}`}>
                              {s.status}
                            </span>
                            {hasError && (
                              <span className="text-xs text-muted">
                                {" "}{isExpanded ? "\u25B2" : "\u25BC"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ];
                      if (isExpanded) {
                        rows.push(
                          <tr key={`${s.id}-err`}>
                            <td colSpan={7}>
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
                  const dotClass = status === "reachable" ? "status-dot-success" : status === "unknown" ? "status-dot-warning" : "status-dot-muted";
                  const label = status === "reachable" ? "Reachable" : status === "unknown" ? "Unknown" : "Checking...";
                  const labelClass = status === "reachable" ? "text-success" : status === "unknown" ? "text-danger" : "text-muted";
                  return (
                    <div key={svc.name} className="svc-card">
                      <div className="flex-between mb-8">
                        <span className="text-mono text-sm">{svc.name}</span>
                        <div className="flex-center gap-8">
                          <span className={`status-dot status-dot-sm ${dotClass}`} />
                          <span className={`text-mono text-xs text-upper ${labelClass}`}>{label}</span>
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
                      const c = ROLE_COLORS[u.role] || "var(--text-secondary)";
                      return (
                        <tr key={i}>
                          <td>{u.name}</td>
                          <td>
                            <span className="badge" style={{ color: c, background: `${c}15`, border: `1px solid ${c}40` }}>
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
                <div className="flex-col gap-8">
                  {systemData.recent_errors.map((err, i) => (
                    <div key={i} className="error-card">
                      <div className="flex-between mb-8">
                        <span className="text-sm">{err.user_name || "Unknown"}</span>
                        <span className="text-mono text-xs text-muted">{fmtDate(err.created_at)}</span>
                      </div>
                      <div className="text-sm text-muted mb-8">{truncate(err.message_text, 50)}</div>
                      <div className="text-sm text-mono text-danger">{err.error}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-errors">
                  <span className="status-dot status-dot-success" />
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
