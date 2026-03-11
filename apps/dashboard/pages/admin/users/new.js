import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const LANG_LABELS = { tr: "Türkçe", en: "English", fr: "Français" };
const ROLE_LABELS = { ceo: "CEO", manager: "Manager", agent: "Agent" };

const DEFAULT_SCOPE = { ceo: "all", manager: "team", agent: "own" };

export default function NewUser() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "", email: "", whatsapp_phone: "", language: "tr",
    role: "agent", office: "", sales_group: "", sales_agent_name: "", is_manager: false,
    data_scope: "own", visible_years: [2025, 2026],
    can_see_expenses: false, can_take_notes: false, can_use_message_generator: false, can_see_financials: false,
  });

  useEffect(() => {
    fetch(`${API}/users/config`).then(r => r.json()).then(setConfig);
  }, []);

  function set(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      // Auto-set data_scope when role changes
      if (key === "role") {
        next.data_scope = DEFAULT_SCOPE[val] || "own";
      }
      return next;
    });
  }

  function toggleYear(y) {
    setForm(prev => ({
      ...prev,
      visible_years: prev.visible_years.includes(y)
        ? prev.visible_years.filter(v => v !== y)
        : [...prev.visible_years, y].sort(),
    }));
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      router.push("/admin");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!config) return <div style={{ padding: 48, color: "#5A7080", background: "#080B10", minHeight: "100vh" }}>Loading...</div>;

  return (
    <>
      <Head><title>ELIZA | New User</title></Head>
      <style jsx global>{`
        :root {
          --bg: #080B10; --surface: #0E1318; --surface-2: #141B22;
          --border: #1E2A35; --text-primary: #E8EDF2; --text-secondary: #5A7080;
          --accent: #C8A97A; --danger: #C0392B; --success: #2ECC71;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--bg); color: var(--text-primary); font-family: "DM Sans", -apple-system, sans-serif; min-height: 100vh; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 24, borderBottom: "1px solid var(--accent)", marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 28, fontWeight: 500, letterSpacing: 6 }}>
              ELIZA<span style={{ color: "var(--accent)" }}>.</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>New User</div>
          </div>
          <Link href="/admin" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>
            ← Back
          </Link>
        </div>

        {error && (
          <div style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 4, padding: "12px 16px", marginBottom: 24, color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <UserForm form={form} set={set} toggleYear={toggleYear} config={config} />

        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <button onClick={save} disabled={saving} style={{
            fontFamily: '"DM Mono", monospace', fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
            padding: "12px 32px", background: "var(--accent)", color: "var(--bg)", border: "none",
            borderRadius: 4, cursor: "pointer", fontWeight: 500, opacity: saving ? 0.5 : 1,
          }}>
            {saving ? "Saving..." : "Save"}
          </button>
          <Link href="/admin" style={{
            fontFamily: '"DM Mono", monospace', fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
            padding: "12px 32px", background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border)", borderRadius: 4, textDecoration: "none",
          }}>
            Cancel
          </Link>
        </div>
      </div>
    </>
  );
}

export function UserForm({ form, set, toggleYear, config }) {
  const inputStyle = {
    width: "100%", padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: 4, color: "var(--text-primary)", fontFamily: '"DM Sans", sans-serif', fontSize: 13, outline: "none",
  };
  const labelStyle = {
    fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase",
    fontFamily: '"DM Mono", monospace', marginBottom: 6, display: "block",
  };
  const sectionStyle = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4,
    padding: 24, marginBottom: 24,
  };
  const sectionTitle = {
    fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--accent)",
    letterSpacing: 3, textTransform: "uppercase", marginBottom: 20,
  };

  return (
    <>
      {/* Section 1 — Personal */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Personal Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full Name" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@elan-expo.com" />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <input style={inputStyle} value={form.whatsapp_phone} onChange={e => set("whatsapp_phone", e.target.value)} placeholder="+90..." />
          </div>
          <div>
            <label style={labelStyle}>Language</label>
            <select style={inputStyle} value={form.language} onChange={e => set("language", e.target.value)}>
              {config.languages.map(l => <option key={l} value={l}>{LANG_LABELS[l] || l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2 — Company */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Company Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Role *</label>
            <select style={inputStyle} value={form.role} onChange={e => set("role", e.target.value)}>
              {config.roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Office</label>
            <select style={inputStyle} value={form.office} onChange={e => set("office", e.target.value)}>
              <option value="">Select...</option>
              {config.offices.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Sales Group</label>
            <select style={inputStyle} value={form.sales_group} onChange={e => set("sales_group", e.target.value)}>
              <option value="">Select...</option>
              {config.sales_groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Zoho Agent Name</label>
            <input style={inputStyle} value={form.sales_agent_name} onChange={e => set("sales_agent_name", e.target.value)} placeholder="e.g. Elif AY" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
            <label style={{ ...labelStyle, marginBottom: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.is_manager} onChange={e => set("is_manager", e.target.checked)}
                style={{ accentColor: "var(--accent)" }} />
              Is Manager?
            </label>
          </div>
        </div>
      </div>

      {/* Section 3 — Data Access */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Data Access</div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Data Scope</label>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[
              { value: "own", label: "Own data only" },
              { value: "team", label: "Team data" },
              { value: "all", label: "All data" },
            ].map(opt => (
              <label key={opt.value} style={{
                display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                color: form.role === "ceo" && opt.value !== "all" ? "var(--text-secondary)" : "var(--text-primary)",
                opacity: form.role === "ceo" && opt.value !== "all" ? 0.4 : 1,
                cursor: form.role === "ceo" ? "not-allowed" : "pointer",
              }}>
                <input type="radio" name="data_scope" value={opt.value}
                  checked={form.data_scope === opt.value}
                  disabled={form.role === "ceo"}
                  onChange={e => set("data_scope", e.target.value)}
                  style={{ accentColor: "var(--accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>
          {form.role === "ceo" && (
            <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 8, fontStyle: "italic" }}>
              CEO role always has access to all data.
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Visible Years</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {config.years.map(y => (
              <label key={y} style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                fontFamily: '"DM Mono", monospace', color: "var(--text-primary)", cursor: "pointer",
                padding: "4px 10px", borderRadius: 3,
                background: form.visible_years.includes(y) ? "rgba(200,169,122,0.1)" : "transparent",
                border: `1px solid ${form.visible_years.includes(y) ? "rgba(200,169,122,0.3)" : "var(--border)"}`,
              }}>
                <input type="checkbox" checked={form.visible_years.includes(y)}
                  onChange={() => toggleYear(y)}
                  style={{ accentColor: "var(--accent)", width: 12, height: 12 }} />
                {y}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Section 4 — Permissions */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Permissions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { key: "can_see_expenses", label: "Can view expenses" },
            { key: "can_take_notes", label: "Can take notes (.note/.today)" },
            { key: "can_use_message_generator", label: "Can generate messages (.msg)" },
            { key: "can_see_financials", label: "Can view financial data" },
          ].map(p => (
            <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", padding: "8px 0" }}>
              <input type="checkbox" checked={form[p.key]} onChange={e => set(p.key, e.target.checked)}
                style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
              {p.label}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
