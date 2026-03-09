import Head from "next/head";
import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

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

export default function WarRoom() {
  const [clock, setClock] = useState("");
  const [summary, setSummary] = useState({});
  const [expos, setExpos] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [byCountry, setByCountry] = useState([]);
  const [byYear, setByYear] = useState([]);

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
    fetch(`${API}/revenue/summary`).then(r => r.json()).then(setSummary);
    fetch(`${API}/expos/metrics`).then(r => r.json()).then(setExpos);
    fetch(`${API}/sales/leaderboard`).then(r => r.json()).then(setLeaderboard);
    fetch(`${API}/revenue/by-country`).then(r => r.json()).then(setByCountry);
    fetch(`${API}/revenue/by-year`).then(r => r.json()).then(setByYear);
  }, []);

  const top10Expos = expos.slice(0, 10);
  const top10Agents = leaderboard.slice(0, 10);
  const top10Countries = byCountry.slice(0, 10);

  const expoChartData = {
    labels: top10Expos.map(e => e.name.length > 30 ? e.name.slice(0, 28) + "…" : e.name),
    datasets: [{
      label: "Revenue (EUR)",
      data: top10Expos.map(e => Number(e.revenue_eur)),
      backgroundColor: "rgba(0, 212, 255, 0.8)",
      borderColor: "#00D4FF",
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const agentChartData = {
    labels: top10Agents.map(a => a.sales_agent.length > 20 ? a.sales_agent.slice(0, 18) + "…" : a.sales_agent),
    datasets: [{
      label: "Revenue (EUR)",
      data: top10Agents.map(a => Number(a.revenue_eur)),
      backgroundColor: "rgba(0, 212, 255, 0.7)",
      borderColor: "#00D4FF",
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const countryColors = [
    "#00D4FF", "#FF6B35", "#00E676", "#FFD600", "#E040FB",
    "#FF5252", "#448AFF", "#69F0AE", "#FF6E40", "#7C4DFF",
  ];

  const countryChartData = {
    labels: top10Countries.map(c => c.country),
    datasets: [{
      data: top10Countries.map(c => Number(c.revenue_eur)),
      backgroundColor: countryColors,
      borderColor: "#0a0e1a",
      borderWidth: 2,
    }],
  };

  const yearChartData = {
    labels: byYear.map(y => y.year),
    datasets: [
      {
        label: "Contracts",
        data: byYear.map(y => Number(y.contracts)),
        borderColor: "#00D4FF",
        backgroundColor: "rgba(0, 212, 255, 0.1)",
        fill: true,
        yAxisID: "y",
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#00D4FF",
      },
      {
        label: "Revenue EUR",
        data: byYear.map(y => Number(y.revenue_eur)),
        borderColor: "#FF6B35",
        backgroundColor: "rgba(255, 107, 53, 0.1)",
        fill: true,
        yAxisID: "y1",
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#FF6B35",
      },
    ],
  };

  const darkChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#8892b0", font: { family: "Space Mono" } } },
      tooltip: {
        backgroundColor: "#1a1f35",
        titleColor: "#00D4FF",
        bodyColor: "#ccd6f6",
        borderColor: "#1e2a4a",
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: €${fmt(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: { ticks: { color: "#8892b0", font: { size: 10 } }, grid: { color: "rgba(136,146,176,0.1)" } },
      y: { ticks: { color: "#8892b0", callback: v => "€" + fmt(v) }, grid: { color: "rgba(136,146,176,0.1)" } },
    },
  };

  const horizontalOptions = {
    ...darkChartOptions,
    indexAxis: "y",
    scales: {
      ...darkChartOptions.scales,
      y: { ticks: { color: "#ccd6f6", font: { size: 11 } }, grid: { display: false } },
      x: { ticks: { color: "#8892b0", callback: v => "€" + fmt(v) }, grid: { color: "rgba(136,146,176,0.1)" } },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { color: "#ccd6f6", font: { size: 11 }, padding: 12 } },
      tooltip: {
        backgroundColor: "#1a1f35",
        titleColor: "#00D4FF",
        bodyColor: "#ccd6f6",
        callbacks: {
          label: (ctx) => `${ctx.label}: €${fmt(ctx.raw)}`,
        },
      },
    },
  };

  const dualAxisOptions = {
    ...darkChartOptions,
    scales: {
      x: { ticks: { color: "#8892b0" }, grid: { color: "rgba(136,146,176,0.1)" } },
      y: {
        type: "linear",
        position: "left",
        ticks: { color: "#00D4FF" },
        grid: { color: "rgba(136,146,176,0.1)" },
        title: { display: true, text: "Contracts", color: "#00D4FF" },
      },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#FF6B35", callback: v => "€" + fmt(v) },
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Revenue EUR", color: "#FF6B35" },
      },
    },
  };

  return (
    <>
      <Head>
        <title>ELIZA War Room</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0a0e1a;
          color: #ccd6f6;
          font-family: "Outfit", sans-serif;
          min-height: 100vh;
        }
        .war-room { max-width: 1440px; margin: 0 auto; padding: 24px 32px; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0 32px;
          border-bottom: 1px solid rgba(0,212,255,0.15);
          margin-bottom: 32px;
        }
        .header h1 {
          font-family: "Space Mono", monospace;
          font-size: 28px;
          color: #00D4FF;
          letter-spacing: 6px;
          text-transform: uppercase;
        }
        .header .subtitle {
          font-size: 13px;
          color: #8892b0;
          letter-spacing: 2px;
          margin-top: 4px;
        }
        .clock {
          font-family: "Space Mono", monospace;
          font-size: 32px;
          color: #00D4FF;
          text-shadow: 0 0 20px rgba(0,212,255,0.3);
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
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
          margin-bottom: 12px;
        }
        .kpi-card .value {
          font-family: "Space Mono", monospace;
          font-size: 26px;
          color: #e6f1ff;
          font-weight: 700;
        }
        .kpi-card.primary .value { color: #00D4FF; }

        .section {
          background: linear-gradient(145deg, #0f1525, #141b2d);
          border: 1px solid rgba(0,212,255,0.08);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .section h2 {
          font-family: "Space Mono", monospace;
          font-size: 14px;
          color: #00D4FF;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0,212,255,0.1);
        }
        .chart-container { height: 380px; }
        .chart-container-sm { height: 320px; }

        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        .leaderboard-table th {
          font-size: 10px;
          color: #8892b0;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          text-align: left;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(0,212,255,0.1);
        }
        .leaderboard-table td {
          font-size: 13px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(136,146,176,0.06);
        }
        .leaderboard-table tr:hover td { background: rgba(0,212,255,0.03); }
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

        @media (max-width: 1024px) {
          .kpi-grid { grid-template-columns: repeat(3, 1fr); }
          .two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .header h1 { font-size: 18px; letter-spacing: 3px; }
          .clock { font-size: 20px; }
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

        {/* KPI CARDS */}
        <div className="kpi-grid">
          <div className="kpi-card primary">
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
          <div className="kpi-card">
            <div className="label">Expos</div>
            <div className="value"><AnimatedNumber value={summary.total_expos} /></div>
          </div>
          <div className="kpi-card">
            <div className="label">Sales Agents</div>
            <div className="value"><AnimatedNumber value={summary.total_agents} /></div>
          </div>
        </div>

        {/* REVENUE BY EXPO */}
        <div className="section">
          <h2>Revenue by Expo — Top 10</h2>
          <div className="chart-container">
            {top10Expos.length > 0 && <Bar data={expoChartData} options={horizontalOptions} />}
          </div>
        </div>

        {/* TWO COLUMN: LEADERBOARD + COUNTRY */}
        <div className="two-col">
          <div className="section">
            <h2>Sales Leaderboard</h2>
            <div className="chart-container-sm">
              {top10Agents.length > 0 && <Bar data={agentChartData} options={horizontalOptions} />}
            </div>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Agent</th>
                  <th style={{ textAlign: "right" }}>Contracts</th>
                  <th style={{ textAlign: "right" }}>M²</th>
                  <th style={{ textAlign: "right" }}>Revenue EUR</th>
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

          <div className="section">
            <h2>Revenue by Country</h2>
            <div className="chart-container">
              {top10Countries.length > 0 && <Doughnut data={countryChartData} options={doughnutOptions} />}
            </div>
          </div>
        </div>

        {/* CONTRACTS OVER TIME */}
        <div className="section">
          <h2>Contracts Over Time</h2>
          <div className="chart-container">
            {byYear.length > 0 && <Line data={yearChartData} options={dualAxisOptions} />}
          </div>
        </div>
      </div>
    </>
  );
}
