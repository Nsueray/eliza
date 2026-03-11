import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

function fmt(n) {
  return Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0 });
}

function fmtEur(n) {
  return "\u20AC" + Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getProgressColor(pct) {
  if (pct >= 70) return "var(--success)";
  if (pct >= 40) return "var(--warning)";
  return "var(--danger)";
}

function getRiskColor(level) {
  if (level === "HIGH") return "var(--danger)";
  if (level === "WATCH") return "var(--warning)";
  if (level === "OK") return "var(--text-secondary)";
  return "var(--success)";
}

export default function ExposPage() {
  const router = useRouter();
  const year = router.query.year || "2026";
  const [expos, setExpos] = useState([]);
  const [riskMap, setRiskMap] = useState({});
  const [sort, setSort] = useState({ key: "start_date", dir: "asc" });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    fetch(`${API}/expos/metrics?year=${year}`).then(r => r.json()).then(setExpos).catch(() => {});
    fetch(`${API}/expos/risk`).then(r => r.json()).then(data => {
      const map = {};
      for (const r of data) map[r.expo_name] = r;
      setRiskMap(map);
    }).catch(() => {});
  }, [router.isReady, year]);

  function handleSort(key) {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  const filtered = expos.filter(e => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (e.name || "").toLowerCase().includes(q)
      || (e.country || "").toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const k = sort.key;
    const va = a[k], vb = b[k];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    return (Number(va) - Number(vb)) * dir;
  });

  const totals = {
    contracts: filtered.reduce((s, e) => s + Number(e.contracts || 0), 0),
    sold_m2: filtered.reduce((s, e) => s + Number(e.sold_m2 || 0), 0),
    revenue_eur: filtered.reduce((s, e) => s + Number(e.revenue_eur || 0), 0),
  };

  const sortIcon = (key) => {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " \u25B2" : " \u25BC";
  };

  return (
    <>
      <Head>
        <title>ELIZA | Expos {year}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style jsx global>{`
        :root {
          --bg: #080B10;
          --surface: #0E1318;
          --surface-2: #141B22;
          --border: #1E2A35;
          --text-primary: #E8EDF2;
          --text-secondary: #5A7080;
          --accent: #C8A97A;
          --accent-2: #4A9EBF;
          --danger: #C0392B;
          --warning: #D4A017;
          --success: #2ECC71;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: var(--bg);
          color: var(--text-primary);
          font-family: "DM Sans", -apple-system, sans-serif;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .page { max-width: 1400px; margin: 0 auto; padding: 32px 48px; }

        .page-hdr {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--accent);
          margin-bottom: 32px;
        }
        .page-brand {
          font-family: "DM Mono", monospace;
          font-size: 32px;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: 8px;
        }
        .page-brand .dot { color: var(--accent); }
        .page-sub {
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .page-nav {
          display: flex;
          gap: 24px;
          align-items: center;
        }
        .nav-link {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover { color: var(--accent); }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .search-input {
          font-family: "DM Sans", sans-serif;
          font-size: 13px;
          padding: 10px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-primary);
          outline: none;
          width: 280px;
          transition: border-color 0.2s;
        }
        .search-input::placeholder { color: var(--text-secondary); }
        .search-input:focus { border-color: var(--accent); }

        .year-tabs {
          display: flex;
          gap: 8px;
        }
        .year-tab {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          letter-spacing: 2px;
          padding: 6px 16px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.2s;
        }
        .year-tab.active {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(200,169,122,0.08);
        }
        .year-tab:hover:not(.active) { border-color: var(--text-secondary); color: var(--text-primary); }

        .summary-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .summary-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          border-radius: 4px;
          padding: 20px 24px;
        }
        .summary-label {
          font-size: 10px;
          color: var(--text-secondary);
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .summary-val {
          font-family: "DM Mono", monospace;
          font-size: 24px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .expo-count {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 1px;
        }

        .tbl {
          width: 100%;
          border-collapse: collapse;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
        }
        .tbl th {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--text-secondary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          text-align: left;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          transition: color 0.2s;
        }
        .tbl th:hover { color: var(--accent); }
        .tbl th.r { text-align: right; }
        .tbl td {
          font-size: 13px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        .tbl td.mono {
          font-family: "DM Mono", monospace;
          font-size: 12px;
        }
        .tbl td.r { text-align: right; }
        .tbl td.muted { color: var(--text-secondary); }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tr:hover td { background: rgba(200,169,122,0.03); }
        .tbl .completed { opacity: 0.45; }

        .badge-done {
          font-family: "DM Mono", monospace;
          font-size: 9px;
          letter-spacing: 1px;
          color: var(--text-secondary);
          background: rgba(90,112,128,0.15);
          padding: 2px 6px;
          border-radius: 3px;
          margin-left: 8px;
        }
        .risk-badge {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1px;
          padding: 3px 8px;
          border-radius: 3px;
          display: inline-block;
        }
        .prog-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: flex-end;
        }
        .prog-bar-wrap {
          width: 80px;
          height: 4px;
          background: rgba(90,112,128,0.15);
          border-radius: 2px;
          overflow: hidden;
        }
        .prog-bar-fill {
          height: 100%;
          border-radius: 2px;
          background: var(--accent);
          transition: width 0.6s ease;
        }
        .prog-pct {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          min-width: 36px;
          text-align: right;
        }
        .no-data {
          text-align: center;
          padding: 48px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .page { padding: 16px; }
          .page-hdr { flex-direction: column; align-items: flex-start; gap: 12px; }
          .page-brand { font-size: 22px; letter-spacing: 4px; }
          .toolbar { flex-direction: column; align-items: stretch; }
          .search-input { width: 100%; }
          .summary-row { grid-template-columns: 1fr; gap: 10px; }
          .summary-val { font-size: 20px; }
          .tbl { font-size: 11px; display: block; overflow-x: auto; }
          .tbl th, .tbl td { padding: 8px 10px; white-space: nowrap; }
          .prog-bar-wrap { width: 50px; }
        }
      `}</style>

      <div className="page">
        {/* HEADER */}
        <div className="page-hdr">
          <div>
            <div className="page-brand">ELIZA<span className="dot">.</span></div>
            <div className="page-sub">Expo Directory</div>
          </div>
          <div className="page-nav">
            <a href="/" className="nav-link">{"\u2190"} War Room</a>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Search expo or country..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="expo-count">{filtered.length} expos</span>
            <div className="year-tabs">
              {["2025", "2026", "2027"].map(y => (
                <button
                  key={y}
                  className={`year-tab ${year === y ? "active" : ""}`}
                  onClick={() => router.push(`/expos?year=${y}`, undefined, { shallow: true })}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="summary-row">
          <div className="summary-card">
            <div className="summary-label">Total Revenue</div>
            <div className="summary-val">{fmtEur(totals.revenue_eur)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Contracts</div>
            <div className="summary-val">{fmt(totals.contracts)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Sold m{"\u00B2"}</div>
            <div className="summary-val">{fmt(totals.sold_m2)}</div>
          </div>
        </div>

        {/* TABLE */}
        {sorted.length === 0 ? (
          <div className="no-data">No expos found for {year}.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th onClick={() => handleSort("name")}>Expo{sortIcon("name")}</th>
                <th onClick={() => handleSort("country")}>Country{sortIcon("country")}</th>
                <th onClick={() => handleSort("start_date")}>Date{sortIcon("start_date")}</th>
                <th className="r" onClick={() => handleSort("contracts")}>Contracts{sortIcon("contracts")}</th>
                <th className="r" onClick={() => handleSort("sold_m2")}>M{"\u00B2"} Sold{sortIcon("sold_m2")}</th>
                <th className="r" onClick={() => handleSort("revenue_eur")}>Revenue{sortIcon("revenue_eur")}</th>
                <th className="r" onClick={() => handleSort("progress_percent")}>Progress{sortIcon("progress_percent")}</th>
                <th className="r">Risk</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(expo => {
                const isCompleted = expo.start_date && new Date(expo.start_date) < new Date();
                const pct = expo.progress_percent ? Number(expo.progress_percent) : null;
                const risk = riskMap[expo.name];
                const riskLevel = risk ? risk.risk_level : null;
                return (
                  <tr key={expo.id} className={isCompleted ? "completed" : ""}>
                    <td>
                      {expo.name}
                      {isCompleted && <span className="badge-done">DONE</span>}
                    </td>
                    <td className="muted">{expo.country || "\u2014"}</td>
                    <td className="mono muted">{formatDate(expo.start_date)}</td>
                    <td className="mono r">{fmt(expo.contracts)}</td>
                    <td className="mono r">{fmt(expo.sold_m2)}</td>
                    <td className="mono r">{fmtEur(expo.revenue_eur)}</td>
                    <td className="r">
                      {pct !== null ? (
                        <div className="prog-cell">
                          <div className="prog-bar-wrap">
                            <div className="prog-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="prog-pct" style={{ color: getProgressColor(pct) }}>{pct}%</span>
                        </div>
                      ) : (
                        <span className="muted">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="r">
                      {riskLevel ? (
                        <span
                          className="risk-badge"
                          style={{
                            color: getRiskColor(riskLevel),
                            background: `${getRiskColor(riskLevel)}15`,
                            border: `1px solid ${getRiskColor(riskLevel)}40`,
                          }}
                        >
                          {riskLevel}
                        </span>
                      ) : (
                        <span className="muted">{"\u2014"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
