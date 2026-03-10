import Head from "next/head";
import { useState, useEffect, useRef } from "react";
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
  return "\u20AC" + Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function AnimatedNumber({ value, prefix = "", duration = 1000 }) {
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

function formatDate(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getProgressColor(pct) {
  if (pct >= 70) return "var(--success)";
  if (pct >= 40) return "var(--warning)";
  return "var(--danger)";
}

function renderAnswer(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    let processed = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^##\s+(.+)/, "<span class='ans-heading'>$1</span>")
      .replace(/^#\s+(.+)/, "<span class='ans-heading'>$1</span>");
    return <span key={i} dangerouslySetInnerHTML={{ __html: processed + (i < text.split("\n").length - 1 ? "<br/>" : "") }} />;
  });
}

export default function WarRoom() {
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [mode, setMode] = useState("edition");
  const [expoView, setExpoView] = useState("upcoming");
  const [editionSummary, setEditionSummary] = useState({});
  const [fiscalSummary, setFiscalSummary] = useState({});
  const [expos, setExpos] = useState([]);
  const [allExpos, setAllExpos] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const suggestions = [
    "Which expos are at risk?",
    "Top sales agents this month",
    "Revenue of SIEMA 2026",
    "How many contracts this year?",
  ];

  function askEliza(question) {
    if (!question.trim() || chatLoading) return;
    setChatLoading(true);
    setChatInput("");
    fetch(`${API}/ai/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim() }),
    })
      .then(r => r.json())
      .then(res => {
        setChatHistory(prev => [
          ...prev.slice(-4),
          { question: question.trim(), answer: res.answer, data: res.data, time: new Date() },
        ]);
        setChatLoading(false);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .catch(() => {
        setChatHistory(prev => [
          ...prev.slice(-4),
          { question: question.trim(), answer: "Connection error. Is the API running?", data: null, time: new Date() },
        ]);
        setChatLoading(false);
      });
  }

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
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
  const displayExpos = expoView === "upcoming" ? expos : allExpos;

  const agentChartData = {
    labels: top10Agents.map(a => a.sales_agent.length > 25 ? a.sales_agent.slice(0, 23) + "\u2026" : a.sales_agent),
    datasets: [{
      label: "Revenue EUR",
      data: top10Agents.map(a => Number(a.revenue_eur)),
      backgroundColor: "rgba(200, 169, 122, 0.7)",
      borderColor: "rgba(200, 169, 122, 0.9)",
      borderWidth: 1,
      borderRadius: 2,
      barThickness: 18,
    }],
  };

  const agentChartOptions = {
    indexAxis: "y",
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
        callbacks: { label: (ctx) => fmtEur(ctx.raw) },
      },
    },
    scales: {
      y: {
        ticks: { color: "#5A7080", font: { family: "DM Sans", size: 11 } },
        grid: { display: false },
      },
      x: {
        ticks: { color: "#3A4A55", font: { family: "DM Mono", size: 10 }, callback: v => fmtEur(v) },
        grid: { color: "rgba(30,42,53,0.5)" },
      },
    },
  };

  return (
    <>
      <Head>
        <title>ELIZA | War Room</title>
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

        .wr { max-width: 1400px; margin: 0 auto; padding: 32px 48px; }

        /* HEADER */
        .hdr {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--accent);
          margin-bottom: 32px;
        }
        .hdr-brand {
          font-family: "DM Mono", monospace;
          font-size: 32px;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: 8px;
        }
        .hdr-brand .dot { color: var(--accent); }
        .hdr-sub {
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .hdr-right { text-align: right; }
        .hdr-clock {
          font-family: "DM Mono", monospace;
          font-size: 24px;
          color: var(--text-primary);
          font-weight: 400;
        }
        .hdr-date {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* MODE TABS */
        .mode-tabs {
          display: flex;
          gap: 32px;
          margin-bottom: 8px;
        }
        .mode-tab {
          font-family: "DM Mono", monospace;
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          padding: 8px 0;
          border: none;
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .mode-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
        .mode-tab:hover:not(.active) { color: var(--text-primary); }
        .mode-desc {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        /* SECTION TITLE */
        .sec-title {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        /* KPI CARDS */
        .kpi-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        .kpi {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          border-radius: 4px;
          padding: 24px 28px;
        }
        .kpi .kpi-label {
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .kpi .kpi-val {
          font-family: "DM Mono", monospace;
          font-size: 30px;
          color: var(--text-primary);
          font-weight: 500;
        }

        /* EXPO TABLE */
        .expo-section { margin-bottom: 40px; }
        .expo-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .view-tabs {
          display: flex;
          gap: 16px;
        }
        .view-tab {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 4px 0;
          border: none;
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-bottom: 1px solid transparent;
          transition: all 0.2s;
        }
        .view-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
        .view-tab:hover:not(.active) { color: var(--text-primary); }
        .expo-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
        }
        .expo-table th {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--text-secondary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          text-align: left;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
        }
        .expo-table th.r { text-align: right; }
        .expo-table td {
          font-size: 13px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }
        .expo-table td.mono {
          font-family: "DM Mono", monospace;
          font-size: 12px;
        }
        .expo-table td.r { text-align: right; }
        .expo-table td.muted { color: var(--text-secondary); }
        .expo-table tr:last-child td { border-bottom: none; }
        .expo-table tr:hover td { background: rgba(200,169,122,0.03); }
        .expo-completed {
          opacity: 0.45;
        }
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

        /* LEADERBOARD */
        .lb-section { margin-bottom: 40px; }
        .lb-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 24px;
        }
        .lb-chart { height: 340px; margin-bottom: 20px; }
        .lb-table {
          width: 100%;
          border-collapse: collapse;
        }
        .lb-table th {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--text-secondary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          text-align: left;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
        }
        .lb-table th.r { text-align: right; }
        .lb-table td {
          font-size: 13px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(30,42,53,0.5);
          color: var(--text-primary);
        }
        .lb-table td.rank {
          font-family: "DM Mono", monospace;
          color: var(--accent);
          font-weight: 500;
          width: 40px;
        }
        .lb-table td.mono {
          font-family: "DM Mono", monospace;
          font-size: 12px;
        }
        .lb-table td.r { text-align: right; }
        .lb-table tr:last-child td { border-bottom: none; }
        .lb-table tr:hover td { background: rgba(200,169,122,0.03); }

        /* CHAT FLOATING BUTTON */
        .chat-fab {
          position: fixed;
          bottom: 32px;
          right: 32px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--surface);
          border: 1px solid var(--accent);
          color: var(--accent);
          font-family: "DM Mono", monospace;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 1000;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }
        .chat-fab:hover {
          background: var(--surface-2);
        }
        .chat-fab.open {
          background: var(--accent);
          color: var(--bg);
        }

        /* CHAT PANEL */
        .chat-panel {
          position: fixed;
          bottom: 90px;
          right: 24px;
          width: 380px;
          max-height: 560px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          z-index: 9999;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
          overflow: hidden;
        }
        .chat-head {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .chat-head-title {
          font-family: "DM Mono", monospace;
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--accent);
        }
        .chat-head-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
        }
        .chat-head-close:hover { color: var(--text-primary); }
        .chat-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 12px 20px;
          border-bottom: 1px solid var(--border);
        }
        .chat-chip {
          font-family: "DM Sans", sans-serif;
          font-size: 11px;
          padding: 5px 12px;
          border-radius: 3px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .chat-chip:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          min-height: 200px;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        .chat-msg { margin-bottom: 20px; }
        .chat-q {
          font-size: 12px;
          color: var(--accent);
          padding-left: 12px;
          border-left: 2px solid var(--accent);
          margin-bottom: 10px;
        }
        .chat-a {
          font-size: 14px;
          color: var(--text-primary);
          line-height: 1.7;
        }
        .chat-a .ans-heading {
          display: block;
          font-family: "DM Mono", monospace;
          font-size: 12px;
          color: var(--accent);
          letter-spacing: 1px;
          margin: 8px 0 4px;
        }
        .chat-a strong { color: var(--accent); font-weight: 500; }
        .chat-time {
          font-family: "DM Mono", monospace;
          font-size: 10px;
          color: var(--text-secondary);
          margin-top: 6px;
          opacity: 0.6;
        }
        .chat-data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11px;
        }
        .chat-data-table th {
          font-family: "DM Mono", monospace;
          font-size: 9px;
          color: var(--accent);
          letter-spacing: 1px;
          text-transform: uppercase;
          text-align: left;
          padding: 6px 8px;
          border-bottom: 1px solid var(--border);
        }
        .chat-data-table td {
          padding: 5px 8px;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(30,42,53,0.4);
          font-family: "DM Mono", monospace;
          font-size: 11px;
        }
        .chat-data-table tr:nth-child(even) td {
          background: rgba(14,19,24,0.5);
        }
        .chat-thinking {
          font-family: "DM Mono", monospace;
          font-size: 12px;
          color: var(--accent);
          padding: 8px 0;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .chat-input-row {
          display: flex;
          border-top: 1px solid var(--border);
        }
        .chat-input {
          flex: 1;
          font-family: "DM Sans", sans-serif;
          font-size: 13px;
          padding: 14px 20px;
          border: none;
          background: var(--surface-2);
          color: var(--text-primary);
          outline: none;
        }
        .chat-input::placeholder { color: var(--text-secondary); }
        .chat-send {
          font-family: "DM Mono", monospace;
          font-size: 11px;
          letter-spacing: 1px;
          padding: 14px 20px;
          border: none;
          background: var(--accent);
          color: var(--bg);
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .chat-send:hover { opacity: 0.85; }
        .chat-send:disabled { opacity: 0.3; cursor: not-allowed; }
        .chat-empty {
          text-align: center;
          padding: 24px 0;
          color: var(--text-secondary);
          font-size: 12px;
        }

        @media (max-width: 768px) {
          .wr { padding: 16px; }
          .hdr { flex-direction: column; align-items: flex-start; gap: 12px; }
          .hdr-brand { font-size: 22px; letter-spacing: 4px; }
          .hdr-clock { font-size: 18px; }
          .hdr-right { text-align: left; }
          .mode-tabs { gap: 20px; }
          .kpi-row { grid-template-columns: 1fr; gap: 12px; }
          .kpi .kpi-val { font-size: 24px; }
          .expo-table { font-size: 11px; }
          .expo-table th, .expo-table td { padding: 8px 10px; }
          .lb-chart { height: 260px; }
          .lb-table th, .lb-table td { padding: 6px 8px; font-size: 11px; }
          .chat-panel { width: calc(100vw - 32px); right: 16px; bottom: 80px; }
          .chat-fab { bottom: 20px; right: 20px; width: 44px; height: 44px; font-size: 16px; }
        }
      `}</style>

      <div className="wr">
        {/* HEADER */}
        <div className="hdr">
          <div>
            <div className="hdr-brand">ELIZA<span className="dot">.</span></div>
            <div className="hdr-sub">War Room</div>
          </div>
          <div className="hdr-right">
            <div className="hdr-clock">{clock}</div>
            <div className="hdr-date">{dateStr}</div>
          </div>
        </div>

        {/* MODE TABS */}
        <div className="mode-tabs">
          <button className={`mode-tab ${mode === "edition" ? "active" : ""}`} onClick={() => setMode("edition")}>
            Edition
          </button>
          <button className={`mode-tab ${mode === "fiscal" ? "active" : ""}`} onClick={() => setMode("fiscal")}>
            Fiscal
          </button>
        </div>
        <div className="mode-desc">
          {mode === "edition"
            ? "Expo performance \u2014 Valid + Transferred In contracts"
            : "Sales performance \u2014 Valid + Transferred Out contracts \u2014 FY 2026"}
        </div>

        {/* KPI CARDS */}
        <div className="sec-title">
          {mode === "edition" ? "Expo Performance" : "Sales Performance"}
        </div>
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-label">Revenue</div>
            <div className="kpi-val"><AnimatedNumber value={summary.total_revenue_eur} prefix={"\u20AC"} /></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Contracts</div>
            <div className="kpi-val"><AnimatedNumber value={summary.total_contracts} /></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Sold M\u00B2</div>
            <div className="kpi-val"><AnimatedNumber value={summary.total_m2} /></div>
          </div>
        </div>

        {/* EXPO RADAR */}
        {mode === "edition" && (
          <div className="expo-section">
            <div className="expo-header">
              <div className="sec-title" style={{ marginBottom: 0 }}>Expo Radar</div>
              <div className="view-tabs">
                <button className={`view-tab ${expoView === "upcoming" ? "active" : ""}`} onClick={() => setExpoView("upcoming")}>
                  Upcoming
                </button>
                <button className={`view-tab ${expoView === "all" ? "active" : ""}`} onClick={() => setExpoView("all")}>
                  All 2026
                </button>
              </div>
            </div>
            <table className="expo-table">
              <thead>
                <tr>
                  <th>Expo</th>
                  <th>Country</th>
                  <th>Date</th>
                  <th className="r">Contracts</th>
                  <th className="r">M{"\u00B2"} Sold</th>
                  <th className="r">Revenue</th>
                  <th className="r">Progress</th>
                </tr>
              </thead>
              <tbody>
                {displayExpos.map(expo => {
                  const isCompleted = expo.start_date && new Date(expo.start_date) < new Date();
                  const pct = expo.progress_percent ? Number(expo.progress_percent) : null;
                  return (
                    <tr key={expo.id} className={isCompleted ? "expo-completed" : ""}>
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
                          <span style={{ color: "var(--text-secondary)", fontSize: 11, fontStyle: "italic" }}>{"\u2014"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SALES LEADERBOARD */}
        <div className="lb-section">
          <div className="sec-title">Sales Leaderboard 2026</div>
          <div className="lb-panel">
            <div className="lb-chart">
              {top10Agents.length > 0 && <Bar data={agentChartData} options={agentChartOptions} />}
            </div>
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Agent</th>
                  <th className="r">Contracts</th>
                  <th className="r">M{"\u00B2"}</th>
                  <th className="r">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {top10Agents.map((a, i) => (
                  <tr key={a.sales_agent}>
                    <td className="rank">{i + 1}</td>
                    <td>{a.sales_agent}</td>
                    <td className="mono r">{fmt(a.contracts)}</td>
                    <td className="mono r">{fmt(a.total_m2)}</td>
                    <td className="mono r">{fmtEur(a.revenue_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ASK ELIZA — FLOATING */}
      <button className={`chat-fab ${chatOpen ? "open" : ""}`} onClick={() => setChatOpen(!chatOpen)}>
        {chatOpen ? "\u00D7" : "\u2726"}
      </button>

      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-head">
            <div className="chat-head-title">{"\u2726"} Ask ELIZA</div>
            <button className="chat-head-close" onClick={() => setChatOpen(false)}>{"\u00D7"}</button>
          </div>
          <div className="chat-chips">
            {suggestions.map(s => (
              <button key={s} className="chat-chip" onClick={() => askEliza(s)}>{s}</button>
            ))}
          </div>
          <div className="chat-messages">
            {chatHistory.length === 0 && !chatLoading && (
              <div className="chat-empty">Ask a question or click a suggestion above.</div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className="chat-msg">
                <div className="chat-q">{msg.question}</div>
                <div className="chat-a">{renderAnswer(msg.answer)}</div>
                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                  <table className="chat-data-table">
                    <thead>
                      <tr>
                        {Object.keys(msg.data[0]).map(col => (
                          <th key={col}>{col.replace(/_/g, " ")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.data.slice(0, 10).map((row, ri) => (
                        <tr key={ri}>
                          {Object.values(row).map((val, ci) => (
                            <td key={ci}>{val != null ? String(val) : "\u2014"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="chat-time">
                  {msg.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="chat-thinking">{"\u2726"} ELIZA is thinking\u2026</div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Ask anything..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") askEliza(chatInput); }}
              autoFocus
            />
            <button
              className="chat-send"
              onClick={() => askEliza(chatInput)}
              disabled={chatLoading || !chatInput.trim()}
            >SEND</button>
          </div>
        </div>
      )}
    </>
  );
}
