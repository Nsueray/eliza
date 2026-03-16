import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Nav from "@/components/Nav";
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ExpoDetailPage() {
  const router = useRouter();
  const { name, year } = router.query;

  const [summary, setSummary] = useState(null);
  const [agents, setAgents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [countries, setCountries] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [agentSort, setAgentSort] = useState({ key: "revenue_eur", dir: "desc" });
  const [companySort, setCompanySort] = useState({ key: "revenue_eur", dir: "desc" });
  const [countrySort, setCountrySort] = useState({ key: "companies", dir: "desc" });
  const [companyFilter, setCompanyFilter] = useState("");
  const [chartMetric, setChartMetric] = useState("revenue_eur");
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => {
    if (!router.isReady || !name || !year) return;
    setLoading(true);
    const params = `name=${encodeURIComponent(name)}&year=${encodeURIComponent(year)}`;
    Promise.all([
      fetch(`${API}/expos/detail?${params}`).then(r => r.json()),
      fetch(`${API}/expos/detail/agents?${params}`).then(r => r.json()),
      fetch(`${API}/expos/detail/companies?${params}`).then(r => r.json()),
      fetch(`${API}/expos/detail/countries?${params}`).then(r => r.json()),
      fetch(`${API}/expos/detail/monthly?${params}`).then(r => r.json()),
    ]).then(([sum, ag, co, cn, mo]) => {
      if (sum.error) { setError(sum.error); setLoading(false); return; }
      setSummary(sum);
      setAgents(Array.isArray(ag) ? ag : []);
      setCompanies(Array.isArray(co) ? co : []);
      setCountries(Array.isArray(cn) ? cn : []);
      setMonthly(Array.isArray(mo) ? mo : []);
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, [router.isReady, name, year]);

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
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  const sortIcon = (sortState, key) => {
    if (sortState.key !== key) return "";
    return sortState.dir === "asc" ? " \u25B2" : " \u25BC";
  };

  const sortedAgents = sortData(agents, agentSort);
  const totalAgentRevenue = agents.reduce((s, a) => s + Number(a.revenue_eur || 0), 0);

  const filteredCompanies = companies.filter(c => {
    if (!companyFilter) return true;
    const q = companyFilter.toLowerCase();
    return (c.company_name || "").toLowerCase().includes(q)
      || (c.country || "").toLowerCase().includes(q)
      || (c.sales_agent || "").toLowerCase().includes(q);
  });
  const sortedCompanies = sortData(filteredCompanies, companySort);
  const sortedCountries = sortData(countries, countrySort);

  // --- Chart data ---
  const chartData = {
    labels: monthly.map(m => `${MONTHS[(m.month || 1) - 1]} ${m.year || ""}`),
    datasets: [{
      label: chartMetric === "revenue_eur" ? "Revenue (\u20AC)" : "Contracts",
      data: monthly.map(m => Number(m[chartMetric] || 0)),
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
      "Share %": totalAgentRevenue > 0 ? Math.round(Number(a.revenue_eur || 0) / totalAgentRevenue * 100) : 0,
    }));
  }

  function buildCompanyRows() {
    return sortedCompanies.map(c => ({
      Company: c.company_name || "",
      Country: c.country || "",
      Agent: c.sales_agent || "",
      "M\u00B2": Number(c.m2 || 0),
      "Revenue (\u20AC)": Number(c.revenue_eur || 0),
      Contracts: Number(c.contracts || 0),
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
      tableToText("AGENTS", buildAgentRows()),
      tableToText("EXHIBITORS", buildCompanyRows()),
      tableToText("COUNTRIES", buildCountryRows()),
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
      toCSV("AGENTS", buildAgentRows()),
      toCSV("EXHIBITORS", buildCompanyRows()),
      toCSV("COUNTRIES", buildCountryRows()),
    ].filter(Boolean);
    downloadFile(`ELIZA_${(summary?.name || "Expo").replace(/\s+/g, "_")}.csv`, parts.join("\n\n"), "text/csv");
  }

  async function handleExcel() {
    try {
      const XLSX = (await import("xlsx")).default || await import("xlsx");
      const wb = XLSX.utils.book_new();
      const wsAgents = XLSX.utils.json_to_sheet(buildAgentRows());
      wsAgents["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsAgents, "Agents");
      const wsCompanies = XLSX.utils.json_to_sheet(buildCompanyRows());
      wsCompanies["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsCompanies, "Exhibitors");
      const wsCountries = XLSX.utils.json_to_sheet(buildCountryRows());
      wsCountries["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsCountries, "Countries");
      XLSX.writeFile(wb, `ELIZA_${(summary?.name || "Expo").replace(/\s+/g, "_")}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
      handleCSV();
    }
  }

  async function handlePDF() {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });
      const expoName = summary?.name || "Expo";
      doc.setFontSize(16);
      doc.text(`ELIZA \u2014 ${expoName} Detail Report`, 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(128);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}  |  ${summary?.country || ""} | ${formatDate(summary?.start_date)}`, 14, 22);

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
      y = addTable("Sales Agents", buildAgentRows(), y);
      if (y > 160) { doc.addPage(); y = 15; }
      y = addTable("Exhibitors", buildCompanyRows(), y);
      if (y > 160) { doc.addPage(); y = 15; }
      addTable("Country Distribution", buildCountryRows(), y);

      doc.save(`ELIZA_${expoName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Check your internet connection.");
    }
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

  // --- Per-table export helpers ---
  function copyTable(rows, label) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join("\t")];
    for (const r of rows) lines.push(headers.map(h => r[h]).join("\t"));
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopyFeedback(label ? `${label} copied!` : "Copied!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  }

  function exportTableCSV(rows, sheetName) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map(h => {
        const v = r[h];
        return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
      }).join(","));
    }
    downloadFile(`ELIZA_${sheetName.replace(/\s+/g, "_")}.csv`, lines.join("\n"), "text/csv");
  }

  async function exportTableExcel(rows, sheetName) {
    if (!rows.length) return;
    try {
      const XLSX = (await import("xlsx")).default || await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `ELIZA_${sheetName.replace(/\s+/g, "_")}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
      exportTableCSV(rows, sheetName);
    }
  }

  const expoTitle = summary?.name || name || "Loading...";
  const pct = summary?.progress_percent ? Number(summary.progress_percent) : null;
  const riskLevel = summary?.risk_level || null;

  return (
    <>
      <Head>
        <title>ELIZA | {expoTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style jsx>{`
        .back-link {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 1px;
          color: var(--text-secondary);
          text-decoration: none;
          margin-bottom: 24px;
          transition: color 0.2s;
        }
        .back-link:hover { color: var(--accent); }

        .expo-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 32px;
        }
        .expo-title {
          font-family: var(--font-mono);
          font-size: 28px;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: 2px;
        }
        .expo-meta {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
          letter-spacing: 1px;
          text-align: right;
        }

        .summary-sub {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 1px;
          margin-bottom: 32px;
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .risk-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1px;
          padding: 3px 8px;
          border-radius: 3px;
          display: inline-block;
        }

        .section-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 1px;
        }

        .search-input {
          font-family: var(--font-sans);
          font-size: 13px;
          padding: 8px 14px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-primary);
          outline: none;
          width: 260px;
          transition: border-color 0.2s;
        }
        .search-input::placeholder { color: var(--text-secondary); }
        .search-input:focus { border-color: var(--accent); }

        .toggle-btn {
          font-family: var(--font-mono);
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

        .share-bar {
          height: 4px;
          border-radius: 2px;
          display: inline-block;
        }

        @media (max-width: 768px) {
          .expo-header { flex-direction: column; align-items: flex-start; gap: 8px; }
          .expo-title { font-size: 20px; }
          .search-input { width: 100%; }
          .chart-wrap { height: 240px; }
        }
      `}</style>

      <div className="page">
        {/* HEADER */}
        <Nav subtitle="Expo Detail" />

        <a href={`/expos?year=${year || "2026"}`} className="back-link">{"\u2190"} Back to Expo Directory</a>

        {loading ? (
          <div className="no-data">Loading...</div>
        ) : error ? (
          <div className="no-data">Expo not found.</div>
        ) : (
          <>
            {/* EXPO HEADER */}
            <div className="expo-header">
              <div className="expo-title">{summary?.name || name}</div>
              <div className="expo-meta">
                {summary?.country || ""}{summary?.country && summary?.start_date ? " | " : ""}{formatDate(summary?.start_date)}
              </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="summary-row">
              <div className="summary-card">
                <div className="summary-label">Revenue</div>
                <div className="summary-val">{fmtEur(summary?.revenue_eur)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Contracts</div>
                <div className="summary-val">{fmt(summary?.contracts)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Sold m{"\u00B2"}</div>
                <div className="summary-val">{fmt(summary?.sold_m2)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Progress</div>
                <div className="summary-val" style={{ color: pct !== null ? getProgressColor(pct) : "var(--text-primary)" }}>
                  {pct !== null ? `${pct}%` : "\u2014"}
                </div>
              </div>
            </div>

            <div className="summary-sub">
              <span>Target m{"\u00B2"}: {summary?.target_m2 ? fmt(summary.target_m2) : "\u2014"}</span>
              <span>
                Risk:{" "}
                {riskLevel ? (
                  <span className="risk-badge" style={{
                    color: getRiskColor(riskLevel),
                    background: `${getRiskColor(riskLevel)}15`,
                    border: `1px solid ${getRiskColor(riskLevel)}40`,
                  }}>{riskLevel}</span>
                ) : "\u2014"}
              </span>
              <span>Velocity: {summary?.velocity_m2_per_month ? `${fmt(Math.round(Number(summary.velocity_m2_per_month)))} m\u00B2/month` : "\u2014"}</span>
            </div>

            {/* EXPORT BAR — ALL DATA */}
            <div className="export-bar">
              {copyFeedback && <span className="export-feedback">{copyFeedback}</span>}
              <button className="btn" onClick={handleCopy}>Copy All</button>
              <button className="btn" onClick={handleCSV}>CSV All</button>
              <button className="btn" onClick={handleExcel}>Excel All</button>
              <button className="btn" onClick={handlePDF}>PDF</button>
            </div>

            {/* AGENTS TABLE */}
            <div className="section-hdr">
              <div className="section-title">Sales Agents</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="section-count">{agents.length} agents</span>
                <button className="btn-sm" onClick={() => copyTable(buildAgentRows(), "Agents")}>Copy</button>
                <button className="btn-sm" onClick={() => exportTableCSV(buildAgentRows(), "Agents")}>CSV</button>
                <button className="btn-sm" onClick={() => exportTableExcel(buildAgentRows(), "Agents")}>Excel</button>
              </div>
            </div>
            {agents.length === 0 ? (
              <div className="no-data">No agent data.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th onClick={() => handleSort(setAgentSort, "name")}>Agent{sortIcon(agentSort, "name")}</th>
                    <th className="r" onClick={() => handleSort(setAgentSort, "contracts")}>Contracts{sortIcon(agentSort, "contracts")}</th>
                    <th className="r" onClick={() => handleSort(setAgentSort, "m2")}>m{"\u00B2"}{sortIcon(agentSort, "m2")}</th>
                    <th className="r" onClick={() => handleSort(setAgentSort, "revenue_eur")}>Revenue{sortIcon(agentSort, "revenue_eur")}</th>
                    <th className="r" style={{ width: 140 }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map(a => {
                    const share = totalAgentRevenue > 0 ? (Number(a.revenue_eur || 0) / totalAgentRevenue * 100) : 0;
                    return (
                      <tr key={a.name}>
                        <td>{a.name}</td>
                        <td className="mono r">{fmt(a.contracts)}</td>
                        <td className="mono r">{fmt(a.m2)}</td>
                        <td className="mono r">{fmtEur(a.revenue_eur)}</td>
                        <td className="r" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          <span className="share-bar" style={{ width: `${Math.max(share, 2)}%`, maxWidth: 80, background: "var(--accent)" }}>{"\u00A0"}</span>
                          <span className="mono" style={{ fontSize: 11, minWidth: 32, textAlign: "right" }}>{Math.round(share)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* COMPANIES TABLE */}
            <div className="section-hdr">
              <div className="section-title">Exhibitors</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="section-count">{filteredCompanies.length} companies</span>
                <input
                  className="search-input"
                  placeholder="Search company, country, agent..."
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  style={{ width: 240 }}
                />
                <button className="btn-sm" onClick={() => copyTable(buildCompanyRows(), "Exhibitors")}>Copy</button>
                <button className="btn-sm" onClick={() => exportTableCSV(buildCompanyRows(), "Exhibitors")}>CSV</button>
                <button className="btn-sm" onClick={() => exportTableExcel(buildCompanyRows(), "Exhibitors")}>Excel</button>
              </div>
            </div>
            {sortedCompanies.length === 0 ? (
              <div className="no-data">No exhibitor data.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th onClick={() => handleSort(setCompanySort, "company_name")}>Company{sortIcon(companySort, "company_name")}</th>
                    <th onClick={() => handleSort(setCompanySort, "country")}>Country{sortIcon(companySort, "country")}</th>
                    <th onClick={() => handleSort(setCompanySort, "sales_agent")}>Agent{sortIcon(companySort, "sales_agent")}</th>
                    <th className="r" onClick={() => handleSort(setCompanySort, "m2")}>m{"\u00B2"}{sortIcon(companySort, "m2")}</th>
                    <th className="r" onClick={() => handleSort(setCompanySort, "revenue_eur")}>Revenue{sortIcon(companySort, "revenue_eur")}</th>
                    <th className="r" onClick={() => handleSort(setCompanySort, "contracts")}>Contracts{sortIcon(companySort, "contracts")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCompanies.map((c, i) => (
                    <tr key={`${c.company_name}-${i}`}>
                      <td>{c.company_name}</td>
                      <td className="muted">{c.country || "\u2014"}</td>
                      <td className="muted">{c.sales_agent || "\u2014"}</td>
                      <td className="mono r">{fmt(c.m2)}</td>
                      <td className="mono r">{fmtEur(c.revenue_eur)}</td>
                      <td className="mono r">{fmt(c.contracts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* COUNTRIES TABLE */}
            <div className="section-hdr">
              <div className="section-title">Country Distribution</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="section-count">{countries.length} countries</span>
                <button className="btn-sm" onClick={() => copyTable(buildCountryRows(), "Countries")}>Copy</button>
                <button className="btn-sm" onClick={() => exportTableCSV(buildCountryRows(), "Countries")}>CSV</button>
                <button className="btn-sm" onClick={() => exportTableExcel(buildCountryRows(), "Countries")}>Excel</button>
              </div>
            </div>
            {countries.length === 0 ? (
              <div className="no-data">No country data.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th onClick={() => handleSort(setCountrySort, "country")}>Country{sortIcon(countrySort, "country")}</th>
                    <th className="r" onClick={() => handleSort(setCountrySort, "companies")}>Companies{sortIcon(countrySort, "companies")}</th>
                    <th className="r" onClick={() => handleSort(setCountrySort, "contracts")}>Contracts{sortIcon(countrySort, "contracts")}</th>
                    <th className="r" onClick={() => handleSort(setCountrySort, "m2")}>m{"\u00B2"}{sortIcon(countrySort, "m2")}</th>
                    <th className="r" onClick={() => handleSort(setCountrySort, "revenue_eur")}>Revenue{sortIcon(countrySort, "revenue_eur")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCountries.map(c => (
                    <tr key={c.country}>
                      <td>{c.country || "\u2014"}</td>
                      <td className="mono r">{fmt(c.companies)}</td>
                      <td className="mono r">{fmt(c.contracts)}</td>
                      <td className="mono r">{fmt(c.m2)}</td>
                      <td className="mono r">{fmtEur(c.revenue_eur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* MONTHLY TREND CHART */}
            <div className="section-hdr">
              <div className="section-title">Monthly Sales</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className={`toggle-btn ${chartMetric === "revenue_eur" ? "active" : ""}`}
                  onClick={() => setChartMetric("revenue_eur")}
                >Revenue</button>
                <button
                  className={`toggle-btn ${chartMetric === "contracts" ? "active" : ""}`}
                  onClick={() => setChartMetric("contracts")}
                >Contracts</button>
              </div>
            </div>
            {monthly.length === 0 ? (
              <div className="no-data">No monthly data.</div>
            ) : (
              <div className="chart-wrap">
                <Bar data={chartData} options={chartOptions} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
