import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

export default function SalesPage() {
  const router = useRouter();
  const [period, setPeriod] = useState("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState(null);
  const [agents, setAgents] = useState([]);
  const [expos, setExpos] = useState([]);
  const [countries, setCountries] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const [agentSort, setAgentSort] = useState({ key: "revenue_eur", dir: "desc" });
  const [expoSort, setExpoSort] = useState({ key: "revenue_eur", dir: "desc" });
  const [countrySort, setCountrySort] = useState({ key: "revenue_eur", dir: "desc" });
  const [chartMetric, setChartMetric] = useState("revenue_eur");
  const [copyFeedback, setCopyFeedback] = useState("");

  function buildParams() {
    if (period === "custom" && customFrom && customTo) {
      return `from=${customFrom}&to=${customTo}`;
    }
    return `period=${period}`;
  }

  useEffect(() => {
    if (period === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    const params = buildParams();
    const granularity = period === "today" || period === "week" ? "daily" : "monthly";
    Promise.all([
      fetch(`${API}/fiscal/summary?${params}`).then(r => r.json()),
      fetch(`${API}/fiscal/by-agent?${params}`).then(r => r.json()),
      fetch(`${API}/fiscal/by-expo?${params}`).then(r => r.json()),
      fetch(`${API}/fiscal/by-country?${params}`).then(r => r.json()),
      fetch(`${API}/fiscal/trend?${params}&granularity=${granularity}`).then(r => r.json()),
    ]).then(([sum, ag, ex, cn, tr]) => {
      setSummary(sum);
      setAgents(Array.isArray(ag) ? ag : []);
      setExpos(Array.isArray(ex) ? ex : []);
      setCountries(Array.isArray(cn) ? cn : []);
      setTrend(Array.isArray(tr) ? tr : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, customFrom, customTo]);

  // --- Sort helpers ---
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
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      return (Number(va) - Number(vb)) * dir;
    });
  }

  const sortIcon = (sortState, key) => {
    if (sortState.key !== key) return "";
    return sortState.dir === "asc" ? " \u25B2" : " \u25BC";
  };

  const sortedAgents = sortData(agents, agentSort);
  const sortedExpos = sortData(expos, expoSort);
  const sortedCountries = sortData(countries, countrySort);
  const totalAgentRevenue = agents.reduce((s, a) => s + Number(a.revenue_eur || 0), 0);

  // --- KPI change indicator ---
  function changeIndicator(pct) {
    if (pct == null || pct === 0) return null;
    const color = pct > 0 ? "var(--success)" : "var(--danger)";
    const arrow = pct > 0 ? "\u2191" : "\u2193";
    return (
      <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color, marginLeft: 8 }}>
        {arrow}{Math.abs(pct)}%
      </span>
    );
  }

  // --- Chart data ---
  const granularity = period === "today" || period === "week" ? "daily" : "monthly";
  const chartData = {
    labels: trend.map(t => {
      if (!t.period) return "";
      const d = new Date(t.period);
      return granularity === "daily"
        ? `${d.getDate()} ${MONTHS[d.getMonth()]}`
        : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }),
    datasets: [{
      label: chartMetric === "revenue_eur" ? "Revenue (\u20AC)" : "Contracts",
      data: trend.map(t => Number(t[chartMetric] || 0)),
      backgroundColor: "rgba(200, 169, 122, 0.7)",
      borderColor: "rgba(200, 169, 122, 0.9)",
      borderWidth: 1,
      borderRadius: 3,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#141B22",
        titleColor: "#C8A97A",
        bodyColor: "#E8EDF2",
        borderColor: "#1E2A35",
        borderWidth: 1,
        callbacks: {
          label: (ctx) => chartMetric === "revenue_eur" ? fmtEur(ctx.raw) : fmt(ctx.raw),
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#5A7080", font: { family: "DM Sans", size: 11 } },
        grid: { color: "rgba(30,42,53,0.5)" },
      },
      y: {
        ticks: {
          color: "#3A4A55",
          font: { family: "DM Mono", size: 10 },
          callback: v => chartMetric === "revenue_eur" ? fmtEur(v) : fmt(v),
        },
        grid: { color: "rgba(30,42,53,0.5)" },
      },
    },
  };

  // --- Export helpers ---
  function buildAgentRows() {
    return sortedAgents.map(a => ({
      Agent: a.name || "",
      Contracts: Number(a.contracts || 0),
      "M\u00B2": Number(a.m2 || 0),
      "Revenue (\u20AC)": Number(a.revenue_eur || 0),
      "Avg/m\u00B2": Number(a.avg_per_m2 || 0),
      "Share %": totalAgentRevenue > 0 ? Math.round(Number(a.revenue_eur || 0) / totalAgentRevenue * 100) : 0,
    }));
  }

  function buildExpoRows() {
    return sortedExpos.map(e => ({
      Expo: e.expo || "",
      Country: e.country || "",
      Contracts: Number(e.contracts || 0),
      "M\u00B2": Number(e.m2 || 0),
      "Revenue (\u20AC)": Number(e.revenue_eur || 0),
    }));
  }

  function buildCountryRows() {
    return sortedCountries.map(c => ({
      Country: c.country || "",
      Companies: Number(c.companies || 0),
      Contracts: Number(c.contracts || 0),
      "M\u00B2": Number(c.m2 || 0),
      "Revenue (\u20AC)": Number(c.revenue_eur || 0),
    }));
  }

  function tableToText(title, rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [`=== ${title} ===`, headers.join("\t")];
    for (const r of rows) lines.push(headers.map(h => r[h]).join("\t"));
    return lines.join("\n");
  }

  function handleCopy() {
    const parts = [
      tableToText("BY AGENT", buildAgentRows()),
      tableToText("BY EXPO", buildExpoRows()),
      tableToText("BY COUNTRY", buildCountryRows()),
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join("\n\n")).then(() => {
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  }

  function handleCSV() {
    function toCSV(title, rows) {
      if (!rows.length) return "";
      const headers = Object.keys(rows[0]);
      const lines = [title, headers.join(",")];
      for (const r of rows) {
        lines.push(headers.map(h => {
          const v = r[h];
          return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
        }).join(","));
      }
      return lines.join("\n");
    }
    const parts = [
      toCSV("BY AGENT", buildAgentRows()),
      toCSV("BY EXPO", buildExpoRows()),
      toCSV("BY COUNTRY", buildCountryRows()),
    ].filter(Boolean);
    downloadFile("ELIZA_Fiscal_Sales.csv", parts.join("\n\n"), "text/csv");
  }

  async function handleExcel() {
    try {
      if (!window.XLSX) {
        await loadScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
      }
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();
      const wsAgents = XLSX.utils.json_to_sheet(buildAgentRows());
      wsAgents["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsAgents, "By Agent");
      const wsExpos = XLSX.utils.json_to_sheet(buildExpoRows());
      wsExpos["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsExpos, "By Expo");
      const wsCountries = XLSX.utils.json_to_sheet(buildCountryRows());
      wsCountries["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsCountries, "By Country");
      XLSX.writeFile(wb, "ELIZA_Fiscal_Sales.xlsx");
    } catch (err) {
      console.error("Excel export failed:", err);
      handleCSV();
    }
  }

  async function handlePDF() {
    try {
      if (!window.jspdf) {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js");
      }
      const doc = new window.jspdf.jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("ELIZA \u2014 Fiscal Sales Report", 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(128);
      const periodLabel = summary?.period ? `${summary.period.from} to ${summary.period.to}` : period;
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}  |  Period: ${periodLabel}`, 14, 22);

      function addTable(title, rows, startY) {
        if (!rows.length) return startY;
        const headers = Object.keys(rows[0]);
        const body = rows.map(r => headers.map(h => r[h]));
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(title, 14, startY);
        doc.autoTable({
          head: [headers],
          body,
          startY: startY + 4,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [14, 19, 24], textColor: [200, 169, 122], fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
        return doc.lastAutoTable.finalY + 12;
      }

      let y = 30;
      y = addTable("Sales by Agent", buildAgentRows(), y);
      if (y > 160) { doc.addPage(); y = 15; }
      y = addTable("Sales by Expo", buildExpoRows(), y);
      if (y > 160) { doc.addPage(); y = 15; }
      addTable("Sales by Country", buildCountryRows(), y);

      doc.save("ELIZA_Fiscal_Sales.pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Check your internet connection.");
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cur = summary?.current || {};
  const chg = summary?.change_pct || {};

  return (
    <>
      <Head>
        <title>ELIZA | Fiscal Sales</title>
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
          margin-bottom: 24px;
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

        .period-bar {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .period-btn {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 6px 14px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.2s;
        }
        .period-btn.active {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(200,169,122,0.08);
        }
        .period-btn:hover:not(.active) { border-color: var(--text-secondary); color: var(--text-primary); }

        .date-input {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          padding: 6px 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 3px;
          color: var(--text-primary);
          outline: none;
        }
        .date-input:focus { border-color: var(--accent); }

        .period-info {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--text-secondary);
          letter-spacing: 1px;
          margin-bottom: 24px;
        }

        .summary-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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

        .section-hdr {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          margin-top: 40px;
        }
        .section-title {
          font-family: "DM Mono", monospace;
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .section-count {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 1px;
        }

        .export-bar {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          margin-bottom: 16px;
        }
        .export-btn {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 6px 14px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .export-btn:hover { border-color: var(--accent); color: var(--accent); }
        .export-feedback {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--success);
          letter-spacing: 1px;
        }

        .toggle-btn {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 5px 12px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.2s;
        }
        .toggle-btn.active {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(200,169,122,0.08);
        }
        .toggle-btn:hover:not(.active) { border-color: var(--text-secondary); color: var(--text-primary); }

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

        .share-bar {
          height: 4px;
          border-radius: 2px;
          display: inline-block;
        }

        .chart-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 24px;
          height: 320px;
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
          .summary-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .summary-val { font-size: 18px; }
          .tbl { font-size: 11px; display: block; overflow-x: auto; }
          .tbl th, .tbl td { padding: 8px 10px; white-space: nowrap; }
          .chart-wrap { height: 240px; }
        }
      `}</style>

      <div className="page">
        {/* HEADER */}
        <div className="page-hdr">
          <div>
            <div className="page-brand">ELIZA<span className="dot">.</span></div>
            <div className="page-sub">Fiscal Sales</div>
          </div>
          <div className="page-nav">
            <a href="/" className="nav-link">War Room</a>
            <a href="/expos?year=2026" className="nav-link">Expo Directory</a>
            <a href="/admin/logs" className="nav-link">Logs</a>
            <a href="/admin/intelligence" className="nav-link">Intelligence</a>
            <a href="/admin/system" className="nav-link">System</a>
            <a href="/admin" className="nav-link">Users</a>
          </div>
        </div>

        {/* PERIOD FILTER BAR */}
        <div className="period-bar">
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`period-btn${period === p.key ? " active" : ""}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <>
              <input type="date" className="date-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>to</span>
              <input type="date" className="date-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </>
          )}
        </div>

        {summary?.period && (
          <div className="period-info">
            {summary.period.from} to {summary.period.to}
          </div>
        )}

        {loading ? (
          <div className="no-data">Loading...</div>
        ) : (
          <>
            {/* KPI CARDS */}
            <div className="summary-row">
              <div className="summary-card">
                <div className="summary-label">Revenue</div>
                <div className="summary-val">{fmtEur(cur.revenue_eur)}{changeIndicator(chg.revenue_eur)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Contracts</div>
                <div className="summary-val">{fmt(cur.contracts)}{changeIndicator(chg.contracts)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Sold m\u00B2</div>
                <div className="summary-val">{fmt(cur.m2)}{changeIndicator(chg.m2)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Avg \u20AC/m\u00B2</div>
                <div className="summary-val">{fmtEur(cur.avg_per_m2)}{changeIndicator(chg.avg_per_m2)}</div>
              </div>
            </div>

            {/* EXPORT BAR */}
            <div className="export-bar">
              {copyFeedback && <span className="export-feedback">{copyFeedback}</span>}
              <button className="export-btn" onClick={handleCopy}>Copy</button>
              <button className="export-btn" onClick={handleCSV}>CSV</button>
              <button className="export-btn" onClick={handleExcel}>Excel</button>
              <button className="export-btn" onClick={handlePDF}>PDF</button>
            </div>

            {/* SALES BY AGENT */}
            <div className="section-hdr">
              <div className="section-title">Sales by Agent</div>
              <div className="section-count">{agents.length} agents</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th onClick={() => handleSort(setAgentSort, "name")}>Agent{sortIcon(agentSort, "name")}</th>
                  <th className="r" onClick={() => handleSort(setAgentSort, "contracts")}>Contracts{sortIcon(agentSort, "contracts")}</th>
                  <th className="r" onClick={() => handleSort(setAgentSort, "m2")}>m\u00B2{sortIcon(agentSort, "m2")}</th>
                  <th className="r" onClick={() => handleSort(setAgentSort, "revenue_eur")}>Revenue{sortIcon(agentSort, "revenue_eur")}</th>
                  <th className="r" onClick={() => handleSort(setAgentSort, "avg_per_m2")}>Avg/m\u00B2{sortIcon(agentSort, "avg_per_m2")}</th>
                  <th className="r" style={{ width: 120 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((a, i) => {
                  const share = totalAgentRevenue > 0 ? Number(a.revenue_eur || 0) / totalAgentRevenue * 100 : 0;
                  return (
                    <tr key={i}>
                      <td>{a.name}</td>
                      <td className="mono r">{fmt(a.contracts)}</td>
                      <td className="mono r">{fmt(a.m2)}</td>
                      <td className="mono r">{fmtEur(a.revenue_eur)}</td>
                      <td className="mono r">{fmtEur(a.avg_per_m2)}</td>
                      <td className="r">
                        <span className="share-bar" style={{ width: `${Math.max(share, 2)}%`, background: "var(--accent)" }} />
                        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)", marginLeft: 6 }}>{Math.round(share)}%</span>
                      </td>
                    </tr>
                  );
                })}
                {sortedAgents.length === 0 && (
                  <tr><td colSpan={6} className="no-data">No data</td></tr>
                )}
              </tbody>
            </table>

            {/* SALES BY EXPO */}
            <div className="section-hdr">
              <div className="section-title">Sales by Expo</div>
              <div className="section-count">{expos.length} expos</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th onClick={() => handleSort(setExpoSort, "expo")}>Expo{sortIcon(expoSort, "expo")}</th>
                  <th onClick={() => handleSort(setExpoSort, "country")}>Country{sortIcon(expoSort, "country")}</th>
                  <th className="r" onClick={() => handleSort(setExpoSort, "contracts")}>Contracts{sortIcon(expoSort, "contracts")}</th>
                  <th className="r" onClick={() => handleSort(setExpoSort, "m2")}>m\u00B2{sortIcon(expoSort, "m2")}</th>
                  <th className="r" onClick={() => handleSort(setExpoSort, "revenue_eur")}>Revenue{sortIcon(expoSort, "revenue_eur")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedExpos.map((e, i) => (
                  <tr key={i} style={{ cursor: "pointer" }} onClick={() => {
                    const expoName = (e.expo || "").replace(/\s+\d{4}$/, "");
                    const expoYear = (e.expo || "").match(/(\d{4})$/)?.[1] || "2026";
                    router.push(`/expos/detail?name=${encodeURIComponent(expoName)}&year=${expoYear}`);
                  }}>
                    <td>{e.expo}</td>
                    <td className="muted">{e.country}</td>
                    <td className="mono r">{fmt(e.contracts)}</td>
                    <td className="mono r">{fmt(e.m2)}</td>
                    <td className="mono r">{fmtEur(e.revenue_eur)}</td>
                  </tr>
                ))}
                {sortedExpos.length === 0 && (
                  <tr><td colSpan={5} className="no-data">No data</td></tr>
                )}
              </tbody>
            </table>

            {/* SALES BY COUNTRY */}
            <div className="section-hdr">
              <div className="section-title">Sales by Country</div>
              <div className="section-count">{countries.length} countries</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th onClick={() => handleSort(setCountrySort, "country")}>Country{sortIcon(countrySort, "country")}</th>
                  <th className="r" onClick={() => handleSort(setCountrySort, "companies")}>Companies{sortIcon(countrySort, "companies")}</th>
                  <th className="r" onClick={() => handleSort(setCountrySort, "contracts")}>Contracts{sortIcon(countrySort, "contracts")}</th>
                  <th className="r" onClick={() => handleSort(setCountrySort, "m2")}>m\u00B2{sortIcon(countrySort, "m2")}</th>
                  <th className="r" onClick={() => handleSort(setCountrySort, "revenue_eur")}>Revenue{sortIcon(countrySort, "revenue_eur")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCountries.map((c, i) => (
                  <tr key={i}>
                    <td>{c.country}</td>
                    <td className="mono r">{fmt(c.companies)}</td>
                    <td className="mono r">{fmt(c.contracts)}</td>
                    <td className="mono r">{fmt(c.m2)}</td>
                    <td className="mono r">{fmtEur(c.revenue_eur)}</td>
                  </tr>
                ))}
                {sortedCountries.length === 0 && (
                  <tr><td colSpan={5} className="no-data">No data</td></tr>
                )}
              </tbody>
            </table>

            {/* TREND CHART */}
            <div className="section-hdr">
              <div className="section-title">Sales Trend</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className={`toggle-btn${chartMetric === "revenue_eur" ? " active" : ""}`} onClick={() => setChartMetric("revenue_eur")}>Revenue</button>
                <button className={`toggle-btn${chartMetric === "contracts" ? " active" : ""}`} onClick={() => setChartMetric("contracts")}>Contracts</button>
              </div>
            </div>
            {trend.length > 0 ? (
              <div className="chart-wrap">
                <Bar data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="no-data">No trend data</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
