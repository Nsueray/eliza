import Head from "next/head";
import Nav from "@/components/Nav";
import { useState, useEffect, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

function fmt(n) {
  return Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0 });
}
function fmtEur(n) {
  return "\u20AC" + Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const STAGE_COLORS = {
  deposit_missing: "#9B59B6",
  no_payment: "#C0392B",
  overdue: "#E67E22",
  pre_event_balance_open: "#D4A017",
  partial_paid: "#4A9EBF",
  paid_complete: "#2ECC71",
  ok: "#5A7080",
};

const STAGE_LABELS = {
  deposit_missing: "Deposit Missing",
  no_payment: "No Payment",
  overdue: "Overdue",
  pre_event_balance_open: "Pre-Event Open",
  partial_paid: "Partial Paid",
  paid_complete: "Paid Complete",
  ok: "OK",
};

function riskLevel(score) {
  const s = Number(score || 0);
  if (s >= 8) return { label: "CRITICAL", color: "#C0392B" };
  if (s >= 5) return { label: "HIGH", color: "#E67E22" };
  if (s >= 3) return { label: "WATCH", color: "#D4A017" };
  return { label: "OK", color: "#2ECC71" };
}

export default function FinancePage() {
  const [mode, setMode] = useState("edition");
  const [summary, setSummary] = useState(null);
  const [actionList, setActionList] = useState({ data: [], total: 0 });
  const [aging, setAging] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [byExpo, setByExpo] = useState([]);
  const [byAgent, setByAgent] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  // Action list filters
  const [stageFilter, setStageFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [actionSort, setActionSort] = useState({ key: "total_risk_score", dir: "desc" });
  const [upcomingDays, setUpcomingDays] = useState(30);
  const [copyFeedback, setCopyFeedback] = useState("");

  // Drawer state
  const [drawer, setDrawer] = useState(null);
  const [drawerData, setDrawerData] = useState(null);

  // Sort states for sub-tables
  const [expoSort, setExpoSort] = useState({ key: "outstanding", dir: "desc" });
  const [agentSort, setAgentSort] = useState({ key: "outstanding", dir: "desc" });

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = `mode=${mode}`;
    Promise.all([
      fetch(`${API}/finance/summary?${params}`).then(r => r.json()),
      fetch(`${API}/finance/action-list?${params}&limit=500`).then(r => r.json()),
      fetch(`${API}/finance/aging?${params}`).then(r => r.json()),
      fetch(`${API}/finance/upcoming?days=${upcomingDays}&${params}`).then(r => r.json()),
      fetch(`${API}/finance/by-expo?${params}`).then(r => r.json()),
      fetch(`${API}/finance/by-agent?${params}`).then(r => r.json()),
      fetch(`${API}/finance/recent-activity?limit=20`).then(r => r.json()),
    ]).then(([sum, al, ag, up, be, ba, ra]) => {
      setSummary(sum);
      setActionList(al || { data: [], total: 0 });
      setAging(Array.isArray(ag) ? ag : []);
      setUpcoming(Array.isArray(up) ? up : []);
      setByExpo(Array.isArray(be) ? be : []);
      setByAgent(Array.isArray(ba) ? ba : []);
      setRecentActivity(Array.isArray(ra) ? ra : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [mode, upcomingDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sort helpers
  function handleSort(setter, key) {
    setter(prev => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
  }
  function sortData(data, sortState) {
    return [...data].sort((a, b) => {
      const dir = sortState.dir === "asc" ? 1 : -1;
      const va = a[sortState.key], vb = b[sortState.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }
  const sortIcon = (s, k) => s.key !== k ? "" : s.dir === "asc" ? " \u25B2" : " \u25BC";

  const sortedExpos = sortData(byExpo, expoSort);
  const sortedAgents = sortData(byAgent, agentSort);

  // Client-side filtering + sorting for action list
  const allActions = actionList.data || [];
  const filteredActions = allActions.filter(r => {
    if (stageFilter && r.collection_stage !== stageFilter) return false;
    if (riskFilter) {
      const rl = riskLevel(r.total_risk_score).label;
      if (rl !== riskFilter) return false;
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const fields = [r.company_name, r.af_number, r.expo_name, r.sales_agent, r.country].map(f => (f || "").toLowerCase());
      if (!fields.some(f => f.includes(q))) return false;
    }
    return true;
  });
  const sortedActions = sortData(filteredActions, actionSort);

  // Drawer: open contract detail
  async function openDrawer(contractId) {
    setDrawer(contractId);
    setDrawerData(null);
    try {
      const resp = await fetch(`${API}/finance/contract/${contractId}/detail`);
      const data = await resp.json();
      setDrawerData(data);
    } catch { setDrawerData({ error: true }); }
  }

  // Export helpers
  function tableToText(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join("\t")];
    for (const r of rows) lines.push(headers.map(h => r[h]).join("\t"));
    return lines.join("\n");
  }
  function handleCopyTable(rows, label) {
    if (!rows.length) return;
    navigator.clipboard.writeText(tableToText(rows)).then(() => {
      setCopyFeedback(label ? `${label} copied!` : "Copied!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  }
  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function exportCSV(rows, name) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map(h => {
        const v = r[h];
        return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
      }).join(","));
    }
    downloadFile(`ELIZA_${name}.csv`, lines.join("\n"), "text/csv");
  }
  async function exportExcel(rows, name) {
    if (!rows.length) return;
    try {
      const XLSX = (await import("xlsx")).default || await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name);
      XLSX.writeFile(wb, `ELIZA_${name}.xlsx`);
    } catch { exportCSV(rows, name); }
  }

  function buildActionRows() {
    return sortedActions.map(r => ({
      Company: r.company_name || "",
      Expo: r.expo_name || "",
      AF: r.af_number || "",
      Agent: r.sales_agent || "",
      "Contract (EUR)": Number(r.contract_total_eur || 0),
      "Paid (EUR)": Number(r.paid_eur || 0),
      "Balance (EUR)": Number(r.balance_eur || 0),
      "Paid %": Number(r.paid_percent || 0),
      "Days Overdue": Number(r.days_overdue || 0),
      "Days to Expo": r.days_to_expo != null ? Number(r.days_to_expo) : "",
      Stage: r.collection_stage || "",
      Risk: Number(r.total_risk_score || 0),
      Action: r.suggested_action || "",
    }));
  }

  // Aging chart data
  const agingChartData = {
    labels: aging.map(a => a.bucket),
    datasets: [{
      label: "Amount (\u20AC)",
      data: aging.map(a => a.amount),
      backgroundColor: [
        "rgba(46,204,113,0.7)", "rgba(200,169,122,0.7)", "rgba(212,160,23,0.7)",
        "rgba(230,126,34,0.7)", "rgba(192,57,43,0.7)", "rgba(142,68,173,0.7)",
      ],
      borderWidth: 0,
      borderRadius: 3,
    }],
  };
  const agingChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#141B22", titleColor: "#C8A97A", bodyColor: "#E8EDF2",
        borderColor: "#1E2A35", borderWidth: 1,
        callbacks: { label: ctx => fmtEur(ctx.raw) },
      },
    },
    scales: {
      x: { ticks: { color: "#5A7080", font: { family: "DM Sans", size: 11 } }, grid: { color: "rgba(30,42,53,0.5)" } },
      y: { ticks: { color: "#3A4A55", font: { family: "DM Mono", size: 10 }, callback: v => fmtEur(v) }, grid: { color: "rgba(30,42,53,0.5)" } },
    },
  };

  return (
    <>
      <Head>
        <title>ELIZA | Finance</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style jsx>{`
        .mode-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; }
        .mode-btn {
          font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: 1px;
          text-transform: uppercase; padding: 6px 14px; border: 1px solid var(--border);
          background: transparent; color: var(--text-secondary); cursor: pointer;
          border-radius: 3px; transition: all 0.2s;
        }
        .mode-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(200,169,122,0.08); }
        .mode-btn:hover:not(.active) { border-color: var(--text-secondary); color: var(--text-primary); }

        .filter-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-chip {
          font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: 1px;
          padding: 4px 10px; border: 1px solid var(--border); background: transparent;
          color: var(--text-secondary); cursor: pointer; border-radius: 12px; transition: all 0.2s;
        }
        .filter-chip.active { border-color: var(--accent); color: var(--accent); background: rgba(200,169,122,0.08); }
        .filter-chip:hover:not(.active) { border-color: var(--text-secondary); }

        .search-input {
          font-family: "DM Mono", monospace; font-size: 11px; padding: 6px 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: 3px;
          color: var(--text-primary); outline: none; width: 200px;
        }
        .search-input:focus { border-color: var(--accent); }
        .search-input::placeholder { color: var(--text-secondary); }

        .stage-badge {
          font-family: "DM Mono", monospace; font-size: 9px; font-weight: 500;
          letter-spacing: 0.5px; padding: 2px 6px; border-radius: 2px;
          display: inline-block; white-space: nowrap;
        }
        .risk-badge {
          font-family: "DM Mono", monospace; font-size: 9px; font-weight: 600;
          letter-spacing: 0.5px; padding: 2px 6px; border-radius: 2px;
          display: inline-block; white-space: nowrap;
        }

        .action-text { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }

        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; }

        .chart-wrap {
          background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
          padding: 24px; height: 280px; box-shadow: var(--card-shadow);
        }

        .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }

        .no-data { text-align: center; padding: 32px; color: var(--text-secondary); font-size: 13px; }

        .tbl-clickable tr { cursor: pointer; }
        .tbl-clickable tr:hover td { background: var(--row-hover); }

        /* Drawer */
        .drawer-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); z-index: 100;
        }
        .drawer {
          position: fixed; top: 0; right: 0; bottom: 0; width: 480px;
          background: var(--bg); border-left: 1px solid var(--border);
          z-index: 101; overflow-y: auto; padding: 32px;
          animation: slideIn 0.2s ease;
        }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .drawer-hdr {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border);
        }
        .drawer-close {
          background: none; border: 1px solid var(--border); color: var(--text-secondary);
          cursor: pointer; padding: 4px 10px; font-family: "DM Mono", monospace; font-size: 11px;
          border-radius: 3px;
        }
        .drawer-close:hover { border-color: var(--accent); color: var(--accent); }
        .drawer-section { margin-bottom: 24px; }
        .drawer-label {
          font-family: "DM Mono", monospace; font-size: 10px; color: var(--text-secondary);
          letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;
        }
        .drawer-val {
          font-family: "DM Mono", monospace; font-size: 14px; color: var(--text-primary);
        }
        .drawer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .drawer-tbl { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .drawer-tbl th {
          font-family: "DM Mono", monospace; font-size: 9px; color: var(--text-secondary);
          letter-spacing: 1px; text-transform: uppercase; text-align: left;
          padding: 6px 8px; border-bottom: 1px solid var(--border);
        }
        .drawer-tbl td {
          font-size: 12px; padding: 6px 8px; border-bottom: 1px solid var(--border);
          color: var(--text-primary); font-family: "DM Mono", monospace;
        }

        @media (max-width: 768px) {
          .kpi-row { grid-template-columns: repeat(2, 1fr); }
          .two-col { grid-template-columns: 1fr; }
          .drawer { width: 100%; }
          .chart-wrap { height: 220px; }
          .col-af, .col-paidpct, .col-overdue { display: none; }
        }
        @media (max-width: 480px) {
          .kpi-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="page">
        <Nav subtitle="Collections Cockpit" />

        {/* MODE TOGGLE */}
        <div className="mode-bar">
          <button className={`mode-btn${mode === "edition" ? " active" : ""}`} onClick={() => setMode("edition")}>Edition</button>
          <button className={`mode-btn${mode === "fiscal" ? " active" : ""}`} onClick={() => setMode("fiscal")}>Fiscal</button>
          <div style={{ flex: 1 }} />
          <input
            className="search-input"
            placeholder="Search company / AF..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
          {copyFeedback && <span className="export-feedback">{copyFeedback}</span>}
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* KPI CARDS — Row 1 */}
            <div className="kpi-row">
              <div className="summary-card">
                <div className="summary-label">Contract Value</div>
                <div className="summary-val">{fmtEur(summary?.contract_value)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Collected</div>
                <div className="summary-val" style={{ color: "var(--success)" }}>{fmtEur(summary?.collected)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Outstanding</div>
                <div className="summary-val">{fmtEur(summary?.outstanding)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Overdue</div>
                <div className="summary-val" style={{ color: "var(--danger)" }}>{fmtEur(summary?.overdue)}</div>
                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
                  {summary?.overdue_count || 0} contracts
                </div>
              </div>
            </div>
            {/* KPI CARDS — Row 2 */}
            <div className="kpi-row">
              <div className="summary-card">
                <div className="summary-label">Due Next 30d</div>
                <div className="summary-val">{fmtEur(summary?.due_next_30)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Collection Rate</div>
                <div className="summary-val">{summary?.collection_rate || 0}%</div>
              </div>
              <div className="summary-card summary-card-danger">
                <div className="summary-label">At-Risk</div>
                <div className="summary-val" style={{ color: "var(--danger)" }}>{fmtEur(summary?.at_risk)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">No Payment</div>
                <div className="summary-val" style={{ color: "var(--warning)" }}>{summary?.no_payment_count || 0}</div>
                <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
                  of {summary?.total_contracts || 0} open
                </div>
              </div>
            </div>

            {/* FILTER CHIPS */}
            <div className="filter-bar">
              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1, marginRight: 4 }}>STAGE:</span>
              {["", "deposit_missing", "no_payment", "overdue", "pre_event_balance_open", "partial_paid"].map(s => (
                <button key={s} className={`filter-chip${stageFilter === s ? " active" : ""}`}
                  onClick={() => setStageFilter(s)}
                  style={s && stageFilter === s ? { borderColor: STAGE_COLORS[s], color: STAGE_COLORS[s] } : {}}>
                  {s ? STAGE_LABELS[s] : "All"}
                </button>
              ))}
              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1, marginLeft: 12, marginRight: 4 }}>RISK:</span>
              {["", "CRITICAL", "HIGH", "WATCH", "OK"].map(r => (
                <button key={r} className={`filter-chip${riskFilter === r ? " active" : ""}`}
                  onClick={() => setRiskFilter(r)}>
                  {r || "All"}
                </button>
              ))}
            </div>

            {/* ACTION LIST TABLE */}
            <div className="section-hdr" style={{ marginTop: 16 }}>
              <div className="section-title">Collection Action List</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1 }}>
                  {filteredActions.length === allActions.length ? `${allActions.length} contracts` : `${filteredActions.length} of ${allActions.length} contracts`}
                </span>
                <button className="btn-sm" onClick={() => handleCopyTable(buildActionRows(), "Actions")}>Copy</button>
                <button className="btn-sm" onClick={() => exportCSV(buildActionRows(), "Collection_Actions")}>CSV</button>
                <button className="btn-sm" onClick={() => exportExcel(buildActionRows(), "Collection_Actions")}>Excel</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl tbl-clickable">
                <thead>
                  <tr>
                    <th onClick={() => handleSort(setActionSort, "company_name")} style={{ minWidth: 180 }}>Company{sortIcon(actionSort, "company_name")}</th>
                    <th onClick={() => handleSort(setActionSort, "expo_name")} style={{ minWidth: 120 }}>Expo{sortIcon(actionSort, "expo_name")}</th>
                    <th onClick={() => handleSort(setActionSort, "af_number")} className="col-af" style={{ minWidth: 80 }}>AF{sortIcon(actionSort, "af_number")}</th>
                    <th onClick={() => handleSort(setActionSort, "sales_agent")} style={{ minWidth: 100 }}>Agent{sortIcon(actionSort, "sales_agent")}</th>
                    <th onClick={() => handleSort(setActionSort, "contract_total_eur")} className="r" style={{ minWidth: 90 }}>Contract{sortIcon(actionSort, "contract_total_eur")}</th>
                    <th onClick={() => handleSort(setActionSort, "paid_eur")} className="r" style={{ minWidth: 80 }}>Paid{sortIcon(actionSort, "paid_eur")}</th>
                    <th onClick={() => handleSort(setActionSort, "balance_eur")} className="r" style={{ minWidth: 90 }}>Balance{sortIcon(actionSort, "balance_eur")}</th>
                    <th onClick={() => handleSort(setActionSort, "paid_percent")} className="r col-paidpct" style={{ minWidth: 60 }}>Paid %{sortIcon(actionSort, "paid_percent")}</th>
                    <th onClick={() => handleSort(setActionSort, "days_overdue")} className="r col-overdue" style={{ minWidth: 70 }}>Overdue{sortIcon(actionSort, "days_overdue")}</th>
                    <th onClick={() => handleSort(setActionSort, "days_to_expo")} className="r" style={{ minWidth: 70 }}>To Expo{sortIcon(actionSort, "days_to_expo")}</th>
                    <th onClick={() => handleSort(setActionSort, "collection_stage")} style={{ minWidth: 100 }}>Stage{sortIcon(actionSort, "collection_stage")}</th>
                    <th onClick={() => handleSort(setActionSort, "total_risk_score")} style={{ minWidth: 60 }}>Risk{sortIcon(actionSort, "total_risk_score")}</th>
                    <th style={{ minWidth: 160 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedActions.map((r, i) => {
                    const risk = riskLevel(r.total_risk_score);
                    const stageColor = STAGE_COLORS[r.collection_stage] || "#5A7080";
                    return (
                      <tr key={i} onClick={() => openDrawer(r.id)}>
                        <td style={{ minWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company_name}</td>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{r.expo_name}</td>
                        <td className="mono col-af" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.af_number}</td>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{r.sales_agent}</td>
                        <td className="mono r">{fmtEur(r.contract_total_eur)}</td>
                        <td className="mono r">{fmtEur(r.paid_eur)}</td>
                        <td className="mono r" style={{ fontWeight: 500 }}>{fmtEur(r.balance_eur)}</td>
                        <td className="mono r col-paidpct">{r.paid_percent}%</td>
                        <td className="mono r col-overdue" style={{ color: Number(r.days_overdue) > 0 ? "var(--danger)" : "var(--text-secondary)" }}>
                          {r.days_overdue > 0 ? r.days_overdue + "d" : "-"}
                        </td>
                        <td className="mono r">{r.days_to_expo != null ? r.days_to_expo + "d" : "-"}</td>
                        <td>
                          <span className="stage-badge" style={{ color: stageColor, background: stageColor + "18", border: `1px solid ${stageColor}40` }}>
                            {STAGE_LABELS[r.collection_stage] || r.collection_stage}
                          </span>
                        </td>
                        <td>
                          <span className="risk-badge" style={{ color: risk.color, background: risk.color + "18", border: `1px solid ${risk.color}40` }}>
                            {risk.label}
                          </span>
                        </td>
                        <td><span className="action-text">{r.suggested_action}</span></td>
                      </tr>
                    );
                  })}
                  {sortedActions.length === 0 && (
                    <tr><td colSpan={13} className="no-data">No outstanding balances</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* A/R AGING + UPCOMING — side by side */}
            <div className="two-col">
              <div>
                <div className="section-hdr" style={{ marginTop: 0 }}>
                  <div className="section-title">A/R Aging</div>
                </div>
                {aging.length > 0 ? (
                  <div className="chart-wrap">
                    <Bar data={agingChartData} options={agingChartOptions} />
                  </div>
                ) : (
                  <div className="no-data">No aging data</div>
                )}
                {/* Aging summary row */}
                {aging.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {aging.map((a, i) => (
                      <div key={i} style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)" }}>
                        {a.bucket}: <span style={{ color: "var(--text-primary)" }}>{fmtEur(a.amount)}</span> ({a.count})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="section-hdr" style={{ marginTop: 0 }}>
                  <div className="section-title">Upcoming Collections</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[7, 14, 30, 60].map(d => (
                      <button key={d} className={`filter-chip${upcomingDays === d ? " active" : ""}`}
                        onClick={() => setUpcomingDays(d)}>
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Expo</th>
                        <th className="r">Amount</th>
                        <th className="r">Due</th>
                        <th className="r">Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((u, i) => (
                        <tr key={i}>
                          <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.company_name}</td>
                          <td className="muted" style={{ whiteSpace: "nowrap" }}>{u.expo_name}</td>
                          <td className="mono r">{fmtEur(u.planned_amount_eur)}</td>
                          <td className="mono r" style={{ whiteSpace: "nowrap" }}>{u.due_date ? new Date(u.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "-"}</td>
                          <td className="mono r" style={{ color: Number(u.days_left) < 7 ? "var(--danger)" : "var(--text-secondary)" }}>
                            {u.days_left}d
                          </td>
                        </tr>
                      ))}
                      {upcoming.length === 0 && (
                        <tr><td colSpan={5} className="no-data">No upcoming payments</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* BY EXPO + BY AGENT — side by side */}
            <div className="two-col">
              <div>
                <div className="section-hdr" style={{ marginTop: 0 }}>
                  <div className="section-title">Outstanding by Expo</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)" }}>{byExpo.length} expos</span>
                    <button className="btn-sm" onClick={() => handleCopyTable(sortedExpos.map(e => ({
                      Expo: e.expo_name, Country: e.expo_country, "Days to Expo": e.days_to_expo,
                      "Contract (EUR)": Number(e.contract_value), "Collected (EUR)": Number(e.collected),
                      "Outstanding (EUR)": Number(e.outstanding), "Collection %": Number(e.collection_pct),
                      "At-Risk (EUR)": Number(e.at_risk), Critical: Number(e.critical_count),
                    })), "Expos")}>Copy</button>
                    <button className="btn-sm" onClick={() => exportCSV(sortedExpos.map(e => ({
                      Expo: e.expo_name, Country: e.expo_country, "Days to Expo": e.days_to_expo,
                      "Contract Value": Number(e.contract_value), Collected: Number(e.collected),
                      Outstanding: Number(e.outstanding), "Collection %": Number(e.collection_pct),
                    })), "Outstanding_by_Expo")}>CSV</button>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort(setExpoSort, "expo_name")}>Expo{sortIcon(expoSort, "expo_name")}</th>
                      <th className="r" onClick={() => handleSort(setExpoSort, "days_to_expo")}>Days{sortIcon(expoSort, "days_to_expo")}</th>
                      <th className="r" onClick={() => handleSort(setExpoSort, "outstanding")}>Outstanding{sortIcon(expoSort, "outstanding")}</th>
                      <th className="r" onClick={() => handleSort(setExpoSort, "collection_pct")}>Coll %{sortIcon(expoSort, "collection_pct")}</th>
                      <th className="r" onClick={() => handleSort(setExpoSort, "critical_count")}>Critical{sortIcon(expoSort, "critical_count")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExpos.map((e, i) => (
                      <tr key={i}>
                        <td>{e.expo_name} <span className="muted" style={{ fontSize: 11 }}>({e.expo_country})</span></td>
                        <td className="mono r">{e.days_to_expo != null ? e.days_to_expo + "d" : "-"}</td>
                        <td className="mono r" style={{ fontWeight: 500 }}>{fmtEur(e.outstanding)}</td>
                        <td className="mono r">{e.collection_pct}%</td>
                        <td className="mono r" style={{ color: Number(e.critical_count) > 0 ? "var(--danger)" : "var(--text-secondary)" }}>
                          {e.critical_count}
                        </td>
                      </tr>
                    ))}
                    {sortedExpos.length === 0 && (
                      <tr><td colSpan={5} className="no-data">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="section-hdr" style={{ marginTop: 0 }}>
                  <div className="section-title">Outstanding by Agent</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)" }}>{byAgent.length} agents</span>
                    <button className="btn-sm" onClick={() => handleCopyTable(sortedAgents.map(a => ({
                      Agent: a.agent, Contracts: Number(a.contracts), "Contract (EUR)": Number(a.contract_value),
                      "Collected (EUR)": Number(a.collected), "Outstanding (EUR)": Number(a.outstanding),
                      "Overdue (EUR)": Number(a.overdue), "Collection %": Number(a.collection_pct),
                    })), "Agents")}>Copy</button>
                    <button className="btn-sm" onClick={() => exportCSV(sortedAgents.map(a => ({
                      Agent: a.agent, Contracts: Number(a.contracts), "Contract Value": Number(a.contract_value),
                      Collected: Number(a.collected), Outstanding: Number(a.outstanding),
                      Overdue: Number(a.overdue), "Collection %": Number(a.collection_pct),
                    })), "Outstanding_by_Agent")}>CSV</button>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort(setAgentSort, "agent")}>Agent{sortIcon(agentSort, "agent")}</th>
                      <th className="r" onClick={() => handleSort(setAgentSort, "contracts")}>Cnt{sortIcon(agentSort, "contracts")}</th>
                      <th className="r" onClick={() => handleSort(setAgentSort, "outstanding")}>Outstanding{sortIcon(agentSort, "outstanding")}</th>
                      <th className="r" onClick={() => handleSort(setAgentSort, "overdue")}>Overdue{sortIcon(agentSort, "overdue")}</th>
                      <th className="r" onClick={() => handleSort(setAgentSort, "collection_pct")}>Coll %{sortIcon(agentSort, "collection_pct")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgents.map((a, i) => (
                      <tr key={i}>
                        <td>{a.agent}</td>
                        <td className="mono r">{a.contracts}</td>
                        <td className="mono r" style={{ fontWeight: 500 }}>{fmtEur(a.outstanding)}</td>
                        <td className="mono r" style={{ color: Number(a.overdue) > 0 ? "var(--danger)" : "var(--text-secondary)" }}>
                          {fmtEur(a.overdue)}
                        </td>
                        <td className="mono r">{a.collection_pct}%</td>
                      </tr>
                    ))}
                    {sortedAgents.length === 0 && (
                      <tr><td colSpan={5} className="no-data">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="section-hdr">
              <div className="section-title">Recent Payments</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Expo</th>
                  <th>AF</th>
                  <th className="r">Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ whiteSpace: "nowrap", fontSize: 11 }}>
                      {r.event_date ? new Date(r.event_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                    </td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company_name}</td>
                    <td className="muted">{r.expo_name}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{r.af_number}</td>
                    <td className="mono r" style={{ color: "var(--success)" }}>{fmtEur(r.amount)}</td>
                    <td className="muted" style={{ fontSize: 11, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note || "-"}</td>
                  </tr>
                ))}
                {recentActivity.length === 0 && (
                  <tr><td colSpan={6} className="no-data">No recent payments</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* DRAWER */}
      {drawer && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawer(null)} />
          <div className="drawer">
            {!drawerData ? (
              <div className="loading">Loading...</div>
            ) : drawerData.error ? (
              <div className="no-data">Error loading contract</div>
            ) : (
              <>
                <div className="drawer-hdr">
                  <div>
                    <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 18, fontWeight: 500, color: "var(--text-primary)" }}>
                      {drawerData.contract.company_name}
                    </div>
                    <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                      {drawerData.contract.af_number} &middot; {drawerData.contract.expo_name}
                    </div>
                  </div>
                  <button className="drawer-close" onClick={() => setDrawer(null)}>CLOSE</button>
                </div>

                <div className="drawer-grid">
                  <div className="drawer-section">
                    <div className="drawer-label">Contract Total</div>
                    <div className="drawer-val">{fmtEur(drawerData.contract.revenue_eur)}</div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Balance</div>
                    <div className="drawer-val" style={{ color: "var(--danger)" }}>{fmtEur(drawerData.contract.balance_eur)}</div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Paid</div>
                    <div className="drawer-val" style={{ color: "var(--success)" }}>{fmtEur(drawerData.contract.paid_eur)}</div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Due Date</div>
                    <div className="drawer-val">
                      {drawerData.contract.due_date ? new Date(drawerData.contract.due_date).toLocaleDateString("en-GB") : "N/A"}
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Agent</div>
                    <div className="drawer-val" style={{ fontSize: 12 }}>{drawerData.contract.sales_agent || "N/A"}</div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Expo Date</div>
                    <div className="drawer-val" style={{ fontSize: 12 }}>
                      {drawerData.contract.expo_start_date ? new Date(drawerData.contract.expo_start_date).toLocaleDateString("en-GB") : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Payment Schedule */}
                <div className="drawer-section" style={{ marginTop: 24 }}>
                  <div className="drawer-label">Payment Schedule</div>
                  {drawerData.schedule.length > 0 ? (
                    <table className="drawer-tbl">
                      <thead>
                        <tr><th>#</th><th>Type</th><th>Due</th><th style={{ textAlign: "right" }}>Amount</th></tr>
                      </thead>
                      <tbody>
                        {drawerData.schedule.map((s, i) => (
                          <tr key={i}>
                            <td>{s.installment_no}</td>
                            <td>{s.payment_type}{s.is_synthetic ? " *" : ""}</td>
                            <td>{s.due_date ? new Date(s.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
                            <td style={{ textAlign: "right" }}>{fmtEur(s.planned_amount_eur)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No schedule</div>
                  )}
                </div>

                {/* Received Payments */}
                <div className="drawer-section">
                  <div className="drawer-label">Received Payments</div>
                  {drawerData.payments.length > 0 ? (
                    <table className="drawer-tbl">
                      <thead>
                        <tr><th>Date</th><th style={{ textAlign: "right" }}>Amount</th><th>Note</th></tr>
                      </thead>
                      <tbody>
                        {drawerData.payments.map((p, i) => (
                          <tr key={i}>
                            <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
                            <td style={{ textAlign: "right", color: "var(--success)" }}>{fmtEur(p.amount_eur)}</td>
                            <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No payments received</div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
