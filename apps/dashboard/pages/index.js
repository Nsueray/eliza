import Head from "next/head";
import { useState, useEffect } from "react";
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

const API = "http://localhost:3001/api";

function fmt(n) {
  return Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0 });
}

function fmtEur(n) {
  return "€" + Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function AnimatedNumber({ value, prefix = "", duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value || 0);
    if (target === 0) { setDisplay(0); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(target);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <span>{prefix}{fmt(display)}</span>;
}

const countryFlags = {
  "Nigeria": "\u{1F1F3}\u{1F1EC}",
  "Ghana": "\u{1F1EC}\u{1F1ED}",
  "Kenya": "\u{1F1F0}\u{1F1EA}",
  "Morocco": "\u{1F1F2}\u{1F1E6}",
  "Algeria": "\u{1F1E9}\u{1F1FF}",
  "Ivory Coast": "\u{1F1E8}\u{1F1EE}",
  "Turkey": "\u{1F1F9}\u{1F1F7}",
};

function getFlag(country) {
  return countryFlags[country] || "\u{1F30D}";
}

function getProgressColor(pct) {
  if (pct >= 70) return "#00E676";
  if (pct >= 40) return "#FFD600";
  return "#FF5252";
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function WarRoom() {
  const [clock, setClock] = useState("");
  const [mode, setMode] = useState("edition");
  const [expoView, setExpoView] = useState("upcoming");
  const [editionSummary, setEditionSummary] = useState({});
  const [fiscalSummary, setFiscalSummary] = useState({});
  const [expos, setExpos] = useState([]);
  const [allExpos, setAllExpos] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(`${API}/revenue/summary`).then(r => r.json()).then(setFiscalSummary);
    fetch(`${API}/expos/metrics`).then(r => r.json()).then(setExpos);
    fetch(`${API}/expos/metrics?year=2026`).then(r => r.json()).then(setAllExpos);
    fetch(`${API}/sales/leaderboard`).then(r => r.json()).then(setLeaderboard);
  }, []);

  useEffect(() => {
    const url = expoView === "all"
      ? `${API}/revenue/edition-summary?year=2026`
      : `${API}/revenue/edition-summary`;
    fetch(url).then(r => r.json()).then(setEditionSummary);
  }, [expoView]);

  const summary = mode === "edition" ? editionSummary : fiscalSummary;
  const top10Agents = leaderboard.slice(0, 10);

  const agentChartData = {
    labels: top10Agents.map(a => a.sales_agent.length > 22 ? a.sales_agent.slice(0, 20) + "\u2026" : a.sales_agent),
    datasets: [{
      label: "Revenue EUR",
      data: top10Agents.map(a => Number(a.revenue_eur)),
      backgroundColor: "rgba(0, 212, 255, 0.75)",
      borderColor: "#00D4FF",
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const agentChartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1a1f35",
        titleColor: "#00D4FF",
        bodyColor: "#ccd6f6",
        borderColor: "#1e2a4a",
        borderWidth: 1,
        callbacks: { label: (ctx) => fmtEur(ctx.raw) },
      },
    },
    scales: {
      y: { ticks: { color: "#ccd6f6", font: { size: 11 } }, grid: { display: false } },
      x: { ticks: { color: "#8892b0", callback: v => fmtEur(v) }, grid: { color: "rgba(136,146,176,0.1)" } },
    },
  };

  return (
    <>
      <Head>
        <title>ELIZA War Room</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0a0e1a;
          color: #ccd6f6;
          font-family: "Outfit", sans-serif;
          min-height: 100vh;
        }
        .war-room { max-width: 1440px; margin: 0 auto; padding: 20px 24px; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0 24px;
          border-bottom: 1px solid rgba(0,212,255,0.15);
          margin-bottom: 24px;
        }
        .header h1 {
          font-family: "Space Mono", monospace;
          font-size: 26px;
          color: #00D4FF;
          letter-spacing: 6px;
          text-transform: uppercase;
        }
        .header .subtitle {
          font-size: 12px;
          color: #8892b0;
          letter-spacing: 2px;
          margin-top: 4px;
        }
        .clock {
          font-family: "Space Mono", monospace;
          font-size: 28px;
          color: #00D4FF;
          text-shadow: 0 0 20px rgba(0,212,255,0.3);
        }

        .toggle-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .toggle-btn {
          font-family: "Space Mono", monospace;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 10px 24px;
          border-radius: 8px;
          border: 1px solid #00D4FF;
          cursor: pointer;
          transition: all 0.3s ease;
          background: transparent;
          color: #00D4FF;
        }
        .toggle-btn.active {
          background: #00D4FF;
          color: #0a0e1a;
          font-weight: 700;
          box-shadow: 0 0 20px rgba(0,212,255,0.25);
        }
        .toggle-btn:not(.active):hover {
          background: rgba(0,212,255,0.1);
        }
        .mode-desc {
          font-size: 12px;
          color: #555d75;
          margin-bottom: 24px;
          font-style: italic;
        }

        .radar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(0,212,255,0.1);
        }
        .radar-toggle {
          display: flex;
          gap: 6px;
        }
        .radar-btn {
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 6px 14px;
          border-radius: 6px;
          border: 1px solid #00D4FF;
          cursor: pointer;
          transition: all 0.3s ease;
          background: transparent;
          color: #00D4FF;
        }
        .radar-btn.active {
          background: #00D4FF;
          color: #0a0e1a;
          font-weight: 700;
        }
        .radar-btn:not(.active):hover {
          background: rgba(0,212,255,0.1);
        }
        .completed-badge {
          display: inline-block;
          font-family: "Space Mono", monospace;
          font-size: 9px;
          letter-spacing: 1px;
          background: rgba(136,146,176,0.2);
          color: #8892b0;
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: 10px;
          vertical-align: middle;
        }

        .section-title {
          font-family: "Space Mono", monospace;
          font-size: 13px;
          color: #00D4FF;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(0,212,255,0.1);
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .kpi-card {
          background: linear-gradient(145deg, #0f1525, #141b2d);
          border: 1px solid rgba(0,212,255,0.12);
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .kpi-card:hover {
          border-color: rgba(0,212,255,0.4);
          box-shadow: 0 0 30px rgba(0,212,255,0.08);
        }
        .kpi-card .label {
          font-size: 11px;
          color: #8892b0;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .kpi-card .value {
          font-family: "Space Mono", monospace;
          font-size: 28px;
          color: #00D4FF;
          font-weight: 700;
        }

        .expo-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .expo-card {
          background: linear-gradient(145deg, #0f1525, #141b2d);
          border: 1px solid rgba(0,212,255,0.08);
          border-radius: 12px;
          padding: 20px;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .expo-card:hover {
          border-color: rgba(0,212,255,0.3);
          box-shadow: 0 0 20px rgba(0,212,255,0.06);
        }
        .expo-card .expo-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .expo-card .expo-name {
          font-size: 16px;
          font-weight: 600;
          color: #e6f1ff;
          line-height: 1.3;
        }
        .expo-card .expo-date {
          font-family: "Space Mono", monospace;
          font-size: 11px;
          color: #8892b0;
          white-space: nowrap;
          margin-left: 12px;
        }
        .expo-card .expo-country {
          font-size: 13px;
          color: #8892b0;
          margin-bottom: 14px;
        }
        .expo-card .expo-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }
        .expo-card .stat {
          text-align: center;
        }
        .expo-card .stat .stat-val {
          font-family: "Space Mono", monospace;
          font-size: 16px;
          color: #e6f1ff;
          font-weight: 700;
        }
        .expo-card .stat .stat-label {
          font-size: 10px;
          color: #8892b0;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 2px;
        }
        .progress-wrap {
          margin-top: 4px;
        }
        .progress-label {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #8892b0;
          margin-bottom: 6px;
        }
        .progress-label .pct {
          font-family: "Space Mono", monospace;
          font-weight: 700;
        }
        .progress-bar {
          height: 6px;
          background: rgba(136,146,176,0.15);
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.8s ease;
        }
        .no-target {
          font-size: 11px;
          color: #555d75;
          font-style: italic;
          margin-top: 4px;
        }

        .panel {
          background: linear-gradient(145deg, #0f1525, #141b2d);
          border: 1px solid rgba(0,212,255,0.08);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }
        .chart-wrap { height: 360px; }

        .lb-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .lb-table th {
          font-size: 10px;
          color: #8892b0;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          text-align: left;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(0,212,255,0.1);
        }
        .lb-table td {
          font-size: 13px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(136,146,176,0.06);
        }
        .lb-table tr:hover td { background: rgba(0,212,255,0.03); }
        .rank {
          font-family: "Space Mono", monospace;
          color: #00D4FF;
          font-weight: 700;
        }
        .agent-name { color: #e6f1ff; }
        .num {
          font-family: "Space Mono", monospace;
          color: #ccd6f6;
          text-align: right;
        }

        @media (max-width: 768px) {
          .war-room { padding: 16px; }
          .header { flex-direction: column; align-items: flex-start; gap: 8px; }
          .header h1 { font-size: 18px; letter-spacing: 3px; }
          .clock { font-size: 20px; }
          .toggle-bar { flex-direction: column; align-items: flex-start; }
          .toggle-btn { padding: 8px 16px; font-size: 11px; }
          .radar-header { flex-direction: column; align-items: flex-start; gap: 10px; }
          .radar-btn { padding: 5px 10px; font-size: 9px; }
          .kpi-grid { grid-template-columns: 1fr; }
          .kpi-card .value { font-size: 22px; }
          .expo-grid { grid-template-columns: 1fr; }
          .chart-wrap { height: 280px; }
          .lb-table th, .lb-table td { padding: 6px 8px; font-size: 11px; }
        }
      `}</style>

      <div className="war-room">
        {/* HEADER */}
        <div className="header">
          <div>
            <h1>ELIZA WAR ROOM</h1>
            <div className="subtitle">Elan Expo Intelligence System</div>
          </div>
          <div className="clock">{clock}</div>
        </div>

        {/* MODE TOGGLE */}
        <div className="toggle-bar">
          <button
            className={`toggle-btn ${mode === "edition" ? "active" : ""}`}
            onClick={() => setMode("edition")}
          >Edition Mode</button>
          <button
            className={`toggle-btn ${mode === "fiscal" ? "active" : ""}`}
            onClick={() => setMode("fiscal")}
          >Fiscal Mode</button>
        </div>
        <div className="mode-desc">
          {mode === "edition"
            ? "Showing expo performance \u2014 Valid + Transferred In contracts"
            : "Showing sales performance \u2014 Valid + Transferred Out contracts"}
        </div>

        {/* KPI CARDS */}
        <h3 className="section-title">
          {mode === "edition" ? "Expo Performance" : "Sales Performance 2026"}
        </h3>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="label">Total Revenue</div>
            <div className="value"><AnimatedNumber value={summary.total_revenue_eur} prefix="€" /></div>
          </div>
          <div className="kpi-card">
            <div className="label">Contracts</div>
            <div className="value"><AnimatedNumber value={summary.total_contracts} /></div>
          </div>
          <div className="kpi-card">
            <div className="label">Total M²</div>
            <div className="value"><AnimatedNumber value={summary.total_m2} /></div>
          </div>
        </div>

        {/* EDITION MODE: EXPO RADAR */}
        {mode === "edition" && (
          <>
            <div className="radar-header">
              <h3 className="section-title" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                {expoView === "upcoming" ? "Expo Radar — Next 12 Months" : "Expo Radar — All 2026"}
              </h3>
              <div className="radar-toggle">
                <button
                  className={`radar-btn ${expoView === "upcoming" ? "active" : ""}`}
                  onClick={() => setExpoView("upcoming")}
                >Upcoming</button>
                <button
                  className={`radar-btn ${expoView === "all" ? "active" : ""}`}
                  onClick={() => setExpoView("all")}
                >All 2026</button>
              </div>
            </div>
            <div className="expo-grid">
              {(expoView === "upcoming" ? expos : allExpos).map(expo => {
                const isCompleted = expo.start_date && new Date(expo.start_date) < new Date();
                const pct = expo.progress_percent ? Number(expo.progress_percent) : null;
                return (
                  <div key={expo.id} className="expo-card" style={isCompleted ? { opacity: 0.6 } : {}}>
                    <div className="expo-header">
                      <div className="expo-name">
                        {expo.name}
                        {isCompleted && <span className="completed-badge">COMPLETED</span>}
                      </div>
                      <div className="expo-date">{formatDate(expo.start_date)}</div>
                    </div>
                    <div className="expo-country">{getFlag(expo.country)} {expo.country || "International"}</div>
                    <div className="expo-stats">
                      <div className="stat">
                        <div className="stat-val">{fmt(expo.contracts)}</div>
                        <div className="stat-label">Contracts</div>
                      </div>
                      <div className="stat">
                        <div className="stat-val">{fmt(expo.sold_m2)}</div>
                        <div className="stat-label">Sold M²</div>
                      </div>
                      <div className="stat">
                        <div className="stat-val">{fmtEur(expo.revenue_eur)}</div>
                        <div className="stat-label">Revenue</div>
                      </div>
                    </div>
                    {pct !== null ? (
                      <div className="progress-wrap">
                        <div className="progress-label">
                          <span>{fmt(expo.sold_m2)} / {fmt(expo.target_m2)} m²</span>
                          <span className="pct" style={{ color: getProgressColor(pct) }}>{pct}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: getProgressColor(pct),
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div className="no-target">No target set</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* SALES LEADERBOARD — always visible */}
        <div className="panel">
          <h3 className="section-title">Sales Leaderboard 2026</h3>
          <div className="chart-wrap">
            {top10Agents.length > 0 && <Bar data={agentChartData} options={agentChartOptions} />}
          </div>
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Agent</th>
                <th style={{ textAlign: "right" }}>Contracts</th>
                <th style={{ textAlign: "right" }}>M²</th>
                <th style={{ textAlign: "right" }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {top10Agents.map((a, i) => (
                <tr key={a.sales_agent}>
                  <td className="rank">{i + 1}</td>
                  <td className="agent-name">{a.sales_agent}</td>
                  <td className="num">{fmt(a.contracts)}</td>
                  <td className="num">{fmt(a.total_m2)}</td>
                  <td className="num">{fmtEur(a.revenue_eur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
