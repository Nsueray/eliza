import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const TABS = ["Countries", "Sectors", "Currencies", "Languages"];

function Badge({ color, children }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 3,
      fontSize: 11, fontFamily: "var(--font-mono)", background: color + "22", color,
    }}>{children}</span>
  );
}

function EditRow({ fields, data, onSave, onCancel }) {
  const [form, setForm] = useState({ ...data });
  return (
    <tr>
      {fields.map(f => (
        <td key={f.key} style={{ padding: "4px 8px" }}>
          {f.readOnly ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{form[f.key]}</span>
          ) : f.key === "is_active" ? (
            <select value={form.is_active ? "true" : "false"} onChange={e => setForm({ ...form, is_active: e.target.value === "true" })}
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 3, padding: "4px 6px", fontSize: 12 }}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          ) : (
            <input value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 3, padding: "4px 6px", fontSize: 12, width: "100%" }} />
          )}
        </td>
      ))}
      <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
        <button onClick={() => onSave(form)} style={{ background: "var(--success)", color: "#fff", border: "none", borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 4 }}>Save</button>
        <button onClick={onCancel} style={{ background: "var(--border)", color: "var(--text-primary)", border: "none", borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
      </td>
    </tr>
  );
}

export default function ReferencePage() {
  const [tab, setTab] = useState("Countries");
  const [data, setData] = useState({ countries: [], sectors: [], currencies: [], languages: [] });
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, cu, l] = await Promise.all([
        fetch(`${API}/reference/countries`).then(r => r.json()),
        fetch(`${API}/reference/sectors`).then(r => r.json()),
        fetch(`${API}/reference/currencies`).then(r => r.json()),
        fetch(`${API}/reference/languages`).then(r => r.json()),
      ]);
      setData({
        countries: c.countries || [],
        sectors: s.sectors || [],
        currencies: cu.currencies || [],
        languages: l.languages || [],
      });
    } catch (err) {
      console.error("Fetch reference data error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSave(type, id, form) {
    try {
      const resp = await fetch(`${API}/reference/${type}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error("Save failed");
      setEditId(null);
      setFeedback("Saved");
      setTimeout(() => setFeedback(null), 2000);
      fetchAll();
    } catch (err) {
      setFeedback("Error: " + err.message);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  const REGION_COLORS = { MENA: "#C8A97A", Europe: "#4A9EBF", Asia: "#2ECC71", Africa: "#D4A017", Americas: "#9B59B6", Oceania: "#1ABC9C" };

  function renderCountries() {
    const fields = [
      { key: "code", label: "Code", readOnly: true },
      { key: "code3", label: "Code3", readOnly: true },
      { key: "name_en", label: "English" },
      { key: "name_tr", label: "Turkish" },
      { key: "name_fr", label: "French" },
      { key: "region", label: "Region" },
      { key: "is_active", label: "Active" },
    ];
    return renderTable(fields, data.countries, "countries", r => r.code);
  }

  function renderSectors() {
    const level1 = data.sectors.filter(s => s.level === 1);
    const level2 = data.sectors.filter(s => s.level === 2);
    const fields = [
      { key: "slug", label: "Slug", readOnly: true },
      { key: "name_en", label: "English" },
      { key: "name_tr", label: "Turkish" },
      { key: "name_fr", label: "French" },
      { key: "display_order", label: "Order" },
      { key: "is_active", label: "Active" },
    ];

    const rows = [];
    for (const parent of level1) {
      rows.push(parent);
      const children = level2.filter(c => c.parent_id === parent.id);
      for (const child of children) rows.push({ ...child, _indent: true });
    }

    return (
      <table className="tbl" style={{ width: "100%" }}>
        <thead>
          <tr>{fields.map(f => <th key={f.key} style={thStyle}>{f.label}</th>)}<th style={thStyle}>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(row => {
            if (editId === row.id) {
              return <EditRow key={row.id} fields={fields} data={row} onSave={form => handleSave("sectors", row.id, form)} onCancel={() => setEditId(null)} />;
            }
            return (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={tdStyle}><span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{row._indent ? "  \u2514 " : ""}{row.slug}</span></td>
                <td style={tdStyle}>{row._indent ? <span style={{ color: "var(--text-secondary)" }}>{row.name_en}</span> : <strong>{row.name_en}</strong>}</td>
                <td style={tdStyle}>{row.name_tr || "\u2014"}</td>
                <td style={tdStyle}>{row.name_fr || "\u2014"}</td>
                <td style={tdStyle}>{row.display_order}</td>
                <td style={tdStyle}>{row.is_active ? <Badge color="var(--success)">Active</Badge> : <Badge color="var(--danger)">Inactive</Badge>}</td>
                <td style={tdStyle}><button onClick={() => setEditId(row.id)} style={editBtnStyle}>Edit</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  function renderCurrencies() {
    const fields = [
      { key: "code", label: "Code", readOnly: true },
      { key: "name_en", label: "Name" },
      { key: "symbol", label: "Symbol" },
      { key: "is_active", label: "Active" },
    ];
    return renderTable(fields, data.currencies, "currencies", r => r.code);
  }

  function renderLanguages() {
    const fields = [
      { key: "code", label: "Code", readOnly: true },
      { key: "name_en", label: "English" },
      { key: "name_native", label: "Native" },
      { key: "is_active", label: "Active" },
    ];
    return renderTable(fields, data.languages, "languages", r => r.code);
  }

  function renderTable(fields, rows, type, getId) {
    return (
      <table className="tbl" style={{ width: "100%" }}>
        <thead>
          <tr>{fields.map(f => <th key={f.key} style={thStyle}>{f.label}</th>)}<th style={thStyle}>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const id = getId(row);
            if (editId === id) {
              return <EditRow key={id} fields={fields} data={row} onSave={form => handleSave(type, id, form)} onCancel={() => setEditId(null)} />;
            }
            return (
              <tr key={id} style={{ borderBottom: "1px solid var(--border)" }}>
                {fields.map(f => (
                  <td key={f.key} style={tdStyle}>
                    {f.key === "is_active" ? (
                      row.is_active ? <Badge color="var(--success)">Active</Badge> : <Badge color="var(--danger)">Inactive</Badge>
                    ) : f.key === "region" ? (
                      <Badge color={REGION_COLORS[row.region] || "var(--text-secondary)"}>{row.region || "\u2014"}</Badge>
                    ) : f.readOnly ? (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{row[f.key]}</span>
                    ) : (
                      row[f.key] || "\u2014"
                    )}
                  </td>
                ))}
                <td style={tdStyle}><button onClick={() => setEditId(id)} style={editBtnStyle}>Edit</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  const thStyle = { padding: "8px", textAlign: "left", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" };
  const tdStyle = { padding: "6px 8px", fontSize: 13 };
  const editBtnStyle = { background: "transparent", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: 3, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono)" };

  return (
    <>
      <Head><title>Reference Data - ELIZA</title></Head>
      <div className="page">
        <Nav subtitle="Reference Data" />

        {feedback && (
          <div style={{ padding: "8px 16px", background: feedback.startsWith("Error") ? "var(--danger)" + "22" : "var(--success)" + "22", color: feedback.startsWith("Error") ? "var(--danger)" : "var(--success)", borderRadius: 4, fontSize: 13, marginBottom: 16 }}>
            {feedback}
          </div>
        )}

        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setEditId(null); }}
              style={{
                padding: "6px 16px", fontSize: 13, fontFamily: "var(--font-mono)",
                background: tab === t ? "var(--accent)" + "22" : "transparent",
                color: tab === t ? "var(--accent)" : "var(--text-secondary)",
                border: tab === t ? "1px solid var(--accent)" + "44" : "1px solid transparent",
                borderRadius: 4, cursor: "pointer",
              }}>
              {t}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)", alignSelf: "center", fontFamily: "var(--font-mono)" }}>
            {tab === "Countries" && `${data.countries.length} rows`}
            {tab === "Sectors" && `${data.sectors.length} rows`}
            {tab === "Currencies" && `${data.currencies.length} rows`}
            {tab === "Languages" && `${data.languages.length} rows`}
          </span>
        </div>

        {loading ? (
          <div className="loading">Loading reference data...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {tab === "Countries" && renderCountries()}
            {tab === "Sectors" && renderSectors()}
            {tab === "Currencies" && renderCurrencies()}
            {tab === "Languages" && renderLanguages()}
          </div>
        )}

        <div style={{ marginTop: 32, padding: 16, background: "var(--surface)", borderRadius: 4, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          <strong style={{ color: "var(--accent)" }}>ELL Reference Data</strong> &mdash; Owner: ELIZA. Read by LiFTY, LEENA.
          <br />Use <em>is_active = false</em> to deactivate (never delete). All three systems FK to these tables.
          <br />Ref: ELL_RULES.md v4 &mdash; R1, R9, ADR-016
        </div>
      </div>
    </>
  );
}
