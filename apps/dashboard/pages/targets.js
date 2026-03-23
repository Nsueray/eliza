import Head from "next/head";
import Nav from "@/components/Nav";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

function fmt(n) {
  return Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0 });
}
function fmtEur(n) {
  return "\u20AC" + Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtK(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return "\u20AC" + (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return "\u20AC" + Math.round(v / 1000) + "K";
  return fmtEur(v);
}
function pctColor(pct) {
  if (pct >= 80) return "var(--success)";
  if (pct >= 50) return "#D4A017";
  return "var(--danger)";
}
function sourceLabel(source, pct) {
  if (source === "manual") return "manual";
  if (source === "auto" && pct != null) return `auto ${pct >= 0 ? "+" : ""}${pct}%`;
  if (source === "no_previous") return "no prev";
  return "none";
}

export default function TargetsPage() {
  const [mode, setMode] = useState("edition");
  const [year, setYear] = useState(2026);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [collapsed, setCollapsed] = useState({});

  // Edit modal
  const [editExpo, setEditExpo] = useState(null);
  const [editMethod, setEditMethod] = useState("auto");
  const [editPct, setEditPct] = useState(15);
  const [editM2, setEditM2] = useState("");
  const [editRev, setEditRev] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPrev, setEditPrev] = useState(null);
  const [editPreview, setEditPreview] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`${API}/targets?year=${year}&mode=${mode}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, mode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Seed auto targets
  async function handleSeed() {
    if (!confirm(`Auto-generate targets for ${year}? This will calculate targets from previous editions (+15%) and detect clusters.`)) return;
    setSeeding(true);
    try {
      await fetch(`${API}/targets/seed?year=${year}`, { method: "POST" });
      fetchData();
    } catch (e) { console.error(e); }
    setSeeding(false);
  }

  // Edit modal
  async function openEdit(expo) {
    setEditExpo(expo);
    setEditNotes("");
    setEditPrev(null);
    setEditPreview(null);
    if (expo.source === "manual") {
      setEditMethod("manual");
      setEditM2(String(expo.target_m2));
      setEditRev(String(expo.target_revenue));
      setEditPct(15);
    } else {
      setEditMethod("auto");
      setEditPct(expo.auto_percentage || 15);
      setEditM2(String(expo.target_m2));
      setEditRev(String(expo.target_revenue));
    }
    // Fetch previous edition
    try {
      const r = await fetch(`${API}/targets/previous/${expo.expo_id}`);
      const prev = await r.json();
      setEditPrev(prev.none ? null : prev);
      // Calculate preview
      if (!prev.none && prev.actual_m2) {
        const mult = 1 + ((expo.auto_percentage || 15) / 100);
        setEditPreview({
          m2: Math.round(Number(prev.actual_m2) * mult),
          rev: Math.round(Number(prev.actual_revenue) * mult),
        });
      }
    } catch { /* ignore */ }
  }

  function updateAutoPreview(pct) {
    setEditPct(pct);
    if (editPrev && editPrev.actual_m2) {
      const mult = 1 + (pct / 100);
      setEditPreview({
        m2: Math.round(Number(editPrev.actual_m2) * mult),
        rev: Math.round(Number(editPrev.actual_revenue) * mult),
      });
    }
  }

  async function saveEdit() {
    if (!editExpo) return;
    setEditSaving(true);
    try {
      const body = editMethod === "auto"
        ? { method: "auto", percentage: Number(editPct), notes: editNotes || undefined }
        : { method: "manual", target_m2: Number(editM2) || 0, target_revenue: Number(editRev) || 0, notes: editNotes || undefined };
      await fetch(`${API}/targets/${editExpo.expo_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setEditExpo(null);
      fetchData();
    } catch (e) { console.error(e); }
    setEditSaving(false);
  }

  // Toggle cluster collapse
  function toggleCluster(id) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Export helpers
  function tableToText(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join("\t")];
    for (const r of rows) lines.push(headers.map(h => r[h]).join("\t"));
    return lines.join("\n");
  }
  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function exportCSV(rows, name) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const r of rows) lines.push(headers.map(h => { const v = r[h]; return typeof v === "string" && v.includes(",") ? `"${v}"` : v; }).join(","));
    downloadFile(`ELIZA_${name}.csv`, lines.join("\n"), "text/csv");
  }
  async function exportExcel(rows, name) {
    if (!rows.length) return;
    try {
      const XLSX = (await import("xlsx")).default || await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
      XLSX.writeFile(wb, `ELIZA_${name}.xlsx`);
    } catch { exportCSV(rows, name); }
  }

  function buildAllRows() {
    if (!data) return [];
    const rows = [];
    for (const c of (data.clusters || [])) {
      for (const e of c.expos) {
        rows.push({
          Cluster: c.cluster_name, Expo: e.expo_name, "Target m\u00B2": e.target_m2,
          "Actual m\u00B2": e.actual_m2, "m\u00B2 %": e.m2_progress,
          "Target \u20AC": e.target_revenue, "Actual \u20AC": e.actual_revenue,
          "\u20AC %": e.revenue_progress, Contracts: e.contracts, Source: sourceLabel(e.source, e.auto_percentage),
        });
      }
    }
    for (const e of (data.standalone || [])) {
      rows.push({
        Cluster: "Standalone", Expo: e.expo_name, "Target m\u00B2": e.target_m2,
        "Actual m\u00B2": e.actual_m2, "m\u00B2 %": e.m2_progress,
        "Target \u20AC": e.target_revenue, "Actual \u20AC": e.actual_revenue,
        "\u20AC %": e.revenue_progress, Contracts: e.contracts, Source: sourceLabel(e.source, e.auto_percentage),
      });
    }
    return rows;
  }

  function buildSummaryText() {
    if (!data) return "";
    const s = data.summary;
    const lines = [`Targets Summary \u2014 ${year}`];
    lines.push(`Total: ${fmt(s.total_target_m2)} m\u00B2 target / ${fmt(s.total_actual_m2)} m\u00B2 actual (${s.m2_progress}%)`);
    lines.push(`Revenue: ${fmtEur(s.total_target_revenue)} target / ${fmtEur(s.total_actual_revenue)} actual (${s.revenue_progress}%)`);
    for (const c of (data.clusters || [])) {
      lines.push("");
      lines.push(`${c.cluster_name}:`);
      for (const e of c.expos) {
        lines.push(`  ${e.expo_name}: ${fmt(e.target_m2)} / ${fmt(e.actual_m2)} m\u00B2 (${e.m2_progress}%)`);
      }
      const ct = c.cluster_total;
      lines.push(`  Total: ${fmt(ct.target_m2)} / ${fmt(ct.actual_m2)} m\u00B2 (${ct.m2_progress}%)`);
    }
    if ((data.standalone || []).length > 0) {
      lines.push("");
      lines.push("Standalone:");
      for (const e of data.standalone) {
        lines.push(`  ${e.expo_name}: ${fmt(e.target_m2)} / ${fmt(e.actual_m2)} m\u00B2 (${e.m2_progress}%)`);
      }
    }
    return lines.join("\n");
  }

  function handleCopy(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(label || "Copied!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  }

  const s = data?.summary;
  const hasTargets = s?.has_targets;

  // Progress bar component
  function ProgressBar({ pct, height = 6 }) {
    const p = Math.min(pct || 0, 100);
    return (
      <div style={{ background: "var(--surface-2)", borderRadius: 3, height, overflow: "hidden", width: "100%" }}>
        <div style={{ width: `${p}%`, height: "100%", background: pctColor(pct || 0), borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    );
  }

  // Render expo row
  function ExpoRow({ e }) {
    return (
      <tr key={e.expo_id}>
        <td>
          <Link href={`/expos/detail?name=${encodeURIComponent(e.expo_name.replace(/\s*\d{4}$/, ""))}&year=${year}`}
            style={{ color: "var(--accent)", textDecoration: "none" }}>
            {e.expo_name}
          </Link>
        </td>
        <td className="mono r">{fmt(e.target_m2)}</td>
        <td className="mono r">{fmt(e.actual_m2)}</td>
        <td style={{ minWidth: 80 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ProgressBar pct={e.m2_progress} />
            <span className="mono" style={{ fontSize: 11, color: pctColor(e.m2_progress), whiteSpace: "nowrap" }}>{e.m2_progress}%</span>
          </div>
        </td>
        <td className="mono r">{fmtK(e.target_revenue)}</td>
        <td className="mono r">{fmtK(e.actual_revenue)}</td>
        <td style={{ minWidth: 80 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ProgressBar pct={e.revenue_progress} />
            <span className="mono" style={{ fontSize: 11, color: pctColor(e.revenue_progress), whiteSpace: "nowrap" }}>{e.revenue_progress}%</span>
          </div>
        </td>
        <td className="mono r">{e.contracts}</td>
        <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sourceLabel(e.source, e.auto_percentage)}</td>
        <td>
          <button className="btn-sm" onClick={() => openEdit(e)} style={{ padding: "3px 10px", fontSize: 11 }}>Edit</button>
        </td>
      </tr>
    );
  }

  return (
    <>
      <Head><title>ELIZA | Targets</title></Head>
      <style jsx global>{`
        .target-control { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .mode-btn { padding: 6px 16px; font-size: 12px; font-family: var(--font-mono); letter-spacing: 1px;
          border: 1px solid var(--border); background: transparent; color: var(--text-secondary);
          cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
        .mode-btn.active { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 600; }
        .year-btn { padding: 5px 14px; font-size: 12px; font-family: var(--font-mono);
          border: 1px solid var(--border); background: transparent; color: var(--text-secondary);
          cursor: pointer; transition: all 0.2s; }
        .year-btn.active { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 600; }
        .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 20px; box-shadow: var(--card-shadow); }
        .kpi-label { font-family: var(--font-mono); font-size: 10px; color: var(--text-secondary);
          letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
        .kpi-val { font-family: var(--font-mono); font-size: 28px; font-weight: 700; color: var(--text-primary); }
        .kpi-sub { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
        .cluster-hdr { display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; cursor: pointer; user-select: none; border-radius: var(--radius);
          margin-bottom: 2px; transition: background 0.2s; }
        .cluster-hdr:hover { opacity: 0.85; }
        .cluster-name { font-weight: 600; font-size: 14px; }
        .cluster-summary { font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); }
        .company-total { font-weight: 700; background: var(--surface-2); }
        .company-total td { border-top: 2px solid var(--accent); padding-top: 10px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex;
          align-items: center; justify-content: center; }
        .modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: 32px; width: 480px; max-width: 95vw; max-height: 90vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
        .modal-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .modal-sub { font-size: 12px; color: var(--text-secondary); margin-bottom: 20px; }
        .modal-section { margin-bottom: 16px; }
        .modal-label { font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary);
          letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
        .modal-row { display: flex; gap: 12px; margin-bottom: 12px; }
        .modal-row > div { flex: 1; }
        .modal-preview { background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px;
          padding: 12px 16px; margin: 12px 0; font-family: var(--font-mono); font-size: 13px; }
        .modal-actions { display: flex; gap: 12px; margin-top: 24px; }
        .no-targets-banner { text-align: center; padding: 60px 20px; background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--radius); margin: 40px 0; }
        @media (max-width: 768px) {
          .kpi-row { grid-template-columns: repeat(2, 1fr); }
          .target-control { gap: 8px; }
          .cluster-hdr { flex-direction: column; align-items: flex-start; gap: 4px; }
        }
        @media (max-width: 480px) {
          .kpi-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="page">
        <Nav subtitle="Target Tracker" />

        {/* Control bar */}
        <div className="target-control">
          <div style={{ display: "flex", gap: 0 }}>
            <button className={`mode-btn${mode === "edition" ? " active" : ""}`}
              style={{ borderRadius: "4px 0 0 4px" }} onClick={() => setMode("edition")}>Edition</button>
            <button className={`mode-btn${mode === "fiscal" ? " active" : ""}`}
              style={{ borderRadius: "0 4px 4px 0" }} onClick={() => setMode("fiscal")}>Fiscal</button>
          </div>

          <div style={{ display: "flex", gap: 0 }}>
            {[2024, 2025, 2026].map(y => (
              <button key={y} className={`year-btn${year === y ? " active" : ""}`}
                style={{ borderRadius: y === 2024 ? "4px 0 0 4px" : y === 2026 ? "0 4px 4px 0" : "0" }}
                onClick={() => setYear(y)}>{y}</button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button className="btn-sm" onClick={handleSeed} disabled={seeding}
            style={{ padding: "6px 16px", fontSize: 11 }}>
            {seeding ? "Seeding..." : "Seed Auto Targets"}
          </button>
          <button className="btn-sm" onClick={() => handleCopy(buildSummaryText(), "Summary copied!")}
            style={{ padding: "6px 16px", fontSize: 11 }}>Copy Summary</button>
          <button className="btn-sm" onClick={() => exportExcel(buildAllRows(), `Targets_${year}`)}
            style={{ padding: "6px 16px", fontSize: 11 }}>Excel All</button>
          {copyFeedback && <span className="export-feedback">{copyFeedback}</span>}
        </div>

        {loading ? (
          <div className="loading" style={{ marginTop: "30vh" }}>Loading...</div>
        ) : !hasTargets ? (
          <div className="no-targets-banner">
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No targets set for {year}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
              Auto-generate from previous editions?
            </div>
            <button className="btn-primary" onClick={handleSeed} disabled={seeding}>
              {seeding ? "Generating..." : "Generate Targets"}
            </button>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="kpi-label">Target m²</div>
                <div className="kpi-val">{fmt(s.total_target_m2)}</div>
                <div className="kpi-sub">across {s.expo_count} expos</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Actual m²</div>
                <div className="kpi-val" style={{ color: pctColor(s.m2_progress) }}>{fmt(s.total_actual_m2)}</div>
                <ProgressBar pct={s.m2_progress} height={8} />
                <div className="kpi-sub" style={{ color: pctColor(s.m2_progress) }}>{s.m2_progress}% of target</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Target Revenue</div>
                <div className="kpi-val">{fmtK(s.total_target_revenue)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Actual Revenue</div>
                <div className="kpi-val" style={{ color: pctColor(s.revenue_progress) }}>{fmtK(s.total_actual_revenue)}</div>
                <ProgressBar pct={s.revenue_progress} height={8} />
                <div className="kpi-sub" style={{ color: pctColor(s.revenue_progress) }}>{s.revenue_progress}% of target</div>
              </div>
            </div>

            {/* Cluster grouped tables */}
            {(data.clusters || []).map(cluster => (
              <div key={cluster.cluster_id} style={{ marginBottom: 16 }}>
                <div className="cluster-hdr" onClick={() => toggleCluster(cluster.cluster_id)}
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>{collapsed[cluster.cluster_id] ? "\u25B6" : "\u25BC"}</span>
                    <span className="cluster-name">{cluster.cluster_name} ({cluster.expos.length} expos)</span>
                  </div>
                  <div className="cluster-summary">
                    {fmt(cluster.cluster_total.target_m2)} / {fmt(cluster.cluster_total.actual_m2)} m²
                    ({cluster.cluster_total.m2_progress}%)
                    {" | "}
                    {fmtK(cluster.cluster_total.target_revenue)} / {fmtK(cluster.cluster_total.actual_revenue)}
                    ({cluster.cluster_total.revenue_progress}%)
                  </div>
                </div>

                {!collapsed[cluster.cluster_id] && (
                  <div style={{ overflowX: "auto" }}>
                    <table className="tbl" style={{ marginTop: 0 }}>
                      <thead>
                        <tr>
                          <th>Expo</th>
                          <th className="r">Target m²</th>
                          <th className="r">Actual m²</th>
                          <th>m² %</th>
                          <th className="r">Target €</th>
                          <th className="r">Actual €</th>
                          <th>€ %</th>
                          <th className="r">Contracts</th>
                          <th>Source</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cluster.expos.map(e => <ExpoRow key={e.expo_id} e={e} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* Standalone expos */}
            {(data.standalone || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="section-hdr" style={{ marginBottom: 8 }}>
                  <div className="section-title">
                    {mode === "fiscal" ? "All Expos" : `Other Expos (${data.standalone.length})`}
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Expo</th>
                        <th className="r">Target m²</th>
                        <th className="r">Actual m²</th>
                        <th>m² %</th>
                        <th className="r">Target €</th>
                        <th className="r">Actual €</th>
                        <th>€ %</th>
                        <th className="r">Contracts</th>
                        <th>Source</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.standalone.map(e => <ExpoRow key={e.expo_id} e={e} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Company Total */}
            {(() => {
              const allExpos = [...(data.clusters || []).flatMap(c => c.expos), ...(data.standalone || [])];
              const totM2 = allExpos.reduce((s, e) => s + e.target_m2, 0);
              const actM2 = allExpos.reduce((s, e) => s + e.actual_m2, 0);
              const totRev = allExpos.reduce((s, e) => s + e.target_revenue, 0);
              const actRev = allExpos.reduce((s, e) => s + e.actual_revenue, 0);
              const totC = allExpos.reduce((s, e) => s + e.contracts, 0);
              const m2p = totM2 > 0 ? Math.round((actM2 / totM2) * 1000) / 10 : 0;
              const rp = totRev > 0 ? Math.round((actRev / totRev) * 1000) / 10 : 0;
              return (
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <tbody>
                      <tr className="company-total">
                        <td style={{ fontWeight: 700 }}>COMPANY TOTAL</td>
                        <td className="mono r">{fmt(totM2)}</td>
                        <td className="mono r">{fmt(actM2)}</td>
                        <td><span className="mono" style={{ color: pctColor(m2p), fontWeight: 700 }}>{m2p}%</span></td>
                        <td className="mono r">{fmtK(totRev)}</td>
                        <td className="mono r">{fmtK(actRev)}</td>
                        <td><span className="mono" style={{ color: pctColor(rp), fontWeight: 700 }}>{rp}%</span></td>
                        <td className="mono r">{totC}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}

        {/* Edit Modal */}
        {editExpo && (
          <div className="modal-overlay" onClick={() => setEditExpo(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Edit Target: {editExpo.expo_name}</div>
              <div className="modal-sub">{editExpo.city}{editExpo.country ? `, ${editExpo.country}` : ""}</div>

              {editPrev && (
                <div className="modal-section">
                  <div className="modal-label">Previous Edition</div>
                  <div style={{ fontSize: 13 }}>
                    <strong>{editPrev.name}</strong>
                    <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                      Actual: {fmt(editPrev.actual_m2)} m² / {fmtEur(editPrev.actual_revenue)} / {editPrev.contracts} contracts
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-section">
                <div className="modal-label">Method</div>
                <div style={{ display: "flex", gap: 0 }}>
                  <button className={`mode-btn${editMethod === "auto" ? " active" : ""}`}
                    style={{ borderRadius: "4px 0 0 4px", fontSize: 11 }}
                    onClick={() => setEditMethod("auto")}>Auto</button>
                  <button className={`mode-btn${editMethod === "manual" ? " active" : ""}`}
                    style={{ borderRadius: "0 4px 4px 0", fontSize: 11 }}
                    onClick={() => setEditMethod("manual")}>Manual</button>
                </div>
              </div>

              {editMethod === "auto" ? (
                <div className="modal-section">
                  <div className="modal-label">Percentage from previous</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input className="input" type="number" value={editPct}
                      onChange={e => updateAutoPreview(Number(e.target.value))}
                      style={{ width: 80, textAlign: "center" }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>%</span>
                  </div>
                  {editPreview && (
                    <div className="modal-preview">
                      Preview: {fmt(editPreview.m2)} m² / {fmtEur(editPreview.rev)}
                    </div>
                  )}
                  {!editPrev && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, fontStyle: "italic" }}>
                      No previous edition found — target will be 0.
                    </div>
                  )}
                </div>
              ) : (
                <div className="modal-section">
                  <div className="modal-row">
                    <div>
                      <div className="modal-label">Target m²</div>
                      <input className="input" type="number" value={editM2}
                        onChange={e => setEditM2(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <div className="modal-label">Target Revenue (€)</div>
                      <input className="input" type="number" value={editRev}
                        onChange={e => setEditRev(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-section">
                <div className="modal-label">Notes (optional)</div>
                <input className="input" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="e.g. CEO override" />
              </div>

              <div className="modal-actions">
                <button className="btn-primary" onClick={saveEdit} disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save"}
                </button>
                <button className="btn" onClick={() => setEditExpo(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
