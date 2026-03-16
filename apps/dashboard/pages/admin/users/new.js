import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Nav from "@/components/Nav";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const LANG_LABELS = { tr: "Turkce", en: "English", fr: "Francais" };
const ROLE_LABELS = { ceo: "CEO", manager: "Manager", agent: "Agent" };

const DEFAULT_SCOPE = { ceo: "all", manager: "team", agent: "own" };

const DASHBOARD_MODULES = [
  { key: "war_room", label: "War Room" },
  { key: "expo_directory", label: "Expo Directory" },
  { key: "expo_detail", label: "Expo Detail" },
  { key: "sales", label: "Sales" },
  { key: "logs", label: "Logs" },
  { key: "intelligence", label: "Intelligence" },
  { key: "system", label: "System" },
  { key: "users", label: "Users" },
  { key: "settings", label: "Settings" },
];

const ROLE_PERM_DEFAULTS = {
  ceo: { war_room: true, expo_directory: true, expo_detail: true, sales: true, logs: true, intelligence: true, system: true, users: true, settings: true },
  manager: { war_room: true, expo_directory: true, expo_detail: true, sales: true, logs: false, intelligence: false, system: false, users: false, settings: true },
  agent: { war_room: false, expo_directory: false, expo_detail: false, sales: true, logs: false, intelligence: false, system: false, users: false, settings: true },
};

export default function NewUser() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "", email: "", whatsapp_phone: "", language: "tr", nicknames: "",
    role: "agent", office: "", sales_group: "", sales_agent_name: "", is_manager: false,
    data_scope: "own", visible_years: [2025, 2026],
    can_see_expenses: false, can_take_notes: false, can_use_message_generator: false, can_see_financials: false,
    dashboard_permissions: { ...ROLE_PERM_DEFAULTS.agent },
  });

  useEffect(() => {
    fetch(`${API}/users/config`).then(r => r.json()).then(setConfig);
  }, []);

  function set(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === "role") {
        next.data_scope = DEFAULT_SCOPE[val] || "own";
        next.dashboard_permissions = { ...(ROLE_PERM_DEFAULTS[val] || ROLE_PERM_DEFAULTS.agent) };
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

  function setPermission(key, val) {
    setForm(prev => ({
      ...prev,
      dashboard_permissions: { ...prev.dashboard_permissions, [key]: val },
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

  if (!config) return <div className="loading" style={{ marginTop: "40vh" }}>Loading...</div>;

  return (
    <>
      <Head><title>ELIZA | New User</title></Head>

      <div className="page" style={{ maxWidth: 800 }}>
        <div className="page-hdr">
          <div>
            <div className="page-brand">ELIZA<span className="dot">.</span></div>
            <div className="page-sub">New User</div>
          </div>
          <Link href="/admin" className="nav-link">&larr; Back</Link>
        </div>

        {error && (
          <div style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 4, padding: "12px 16px", marginBottom: 24, color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <UserForm form={form} set={set} toggleYear={toggleYear} config={config} setPermission={setPermission} />

        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save"}
          </button>
          <Link href="/admin" className="btn" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            Cancel
          </Link>
        </div>
      </div>
    </>
  );
}

export { DASHBOARD_MODULES, ROLE_PERM_DEFAULTS };

export function UserForm({ form, set, toggleYear, config, setPermission }) {
  const isCeo = form.role === "ceo";
  const perms = form.dashboard_permissions || {};

  return (
    <>
      <style jsx global>{`
        .form-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: var(--card-shadow);
        }
        .form-section-title {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-full { grid-column: 1 / -1; }
        .form-hint { font-size: 10px; color: var(--text-secondary); margin-top: 4px; }
        .year-chip {
          display: flex; align-items: center; gap: 4px; font-size: 12px;
          font-family: var(--font-mono); color: var(--text-primary); cursor: pointer;
          padding: 4px 10px; border-radius: 3px; transition: all 0.2s;
        }
        .perm-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
        }
        .perm-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          padding: 8px 0;
          cursor: pointer;
        }
        .perm-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @media (max-width: 768px) {
          .form-grid { grid-template-columns: 1fr; }
          .perm-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Section 1 -- Personal */}
      <div className="form-section">
        <div className="form-section-title">Personal Information</div>
        <div className="form-grid">
          <div>
            <label className="input-label">Name *</label>
            <input className="input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full Name" />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input className="input" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@elan-expo.com" />
          </div>
          <div>
            <label className="input-label">WhatsApp</label>
            <input className="input" value={form.whatsapp_phone} onChange={e => set("whatsapp_phone", e.target.value)} placeholder="+90..." />
          </div>
          <div>
            <label className="input-label">Language</label>
            <select className="input" value={form.language} onChange={e => set("language", e.target.value)}>
              {config.languages.map(l => <option key={l} value={l}>{LANG_LABELS[l] || l}</option>)}
            </select>
          </div>
          <div className="form-full">
            <label className="input-label">Nicknames</label>
            <input className="input" value={form.nicknames} onChange={e => set("nicknames", e.target.value)} placeholder="baba,babacim,patron" />
            <div className="form-hint">Comma-separated. Used for personalized greetings.</div>
          </div>
        </div>
      </div>

      {/* Section 2 -- Company */}
      <div className="form-section">
        <div className="form-section-title">Company Information</div>
        <div className="form-grid">
          <div>
            <label className="input-label">Role *</label>
            <select className="input" value={form.role} onChange={e => set("role", e.target.value)}>
              {config.roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Office</label>
            <select className="input" value={form.office} onChange={e => set("office", e.target.value)}>
              <option value="">Select...</option>
              {config.offices.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Sales Group</label>
            <select className="input" value={form.sales_group} onChange={e => set("sales_group", e.target.value)}>
              <option value="">Select...</option>
              {config.sales_groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Zoho Agent Name</label>
            <input className="input" value={form.sales_agent_name} onChange={e => set("sales_agent_name", e.target.value)} placeholder="e.g. Elif AY" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} className="input-label">
              <input type="checkbox" checked={form.is_manager} onChange={e => set("is_manager", e.target.checked)}
                style={{ accentColor: "var(--accent)" }} />
              Is Manager?
            </label>
          </div>
        </div>
      </div>

      {/* Section 3 -- Data Access */}
      <div className="form-section">
        <div className="form-section-title">Data Access</div>
        <div style={{ marginBottom: 20 }}>
          <label className="input-label">Data Scope</label>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[
              { value: "own", label: "Own data only" },
              { value: "team", label: "Team data" },
              { value: "all", label: "All data" },
            ].map(opt => (
              <label key={opt.value} style={{
                display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                color: isCeo && opt.value !== "all" ? "var(--text-secondary)" : "var(--text-primary)",
                opacity: isCeo && opt.value !== "all" ? 0.4 : 1,
                cursor: isCeo ? "not-allowed" : "pointer",
              }}>
                <input type="radio" name="data_scope" value={opt.value}
                  checked={form.data_scope === opt.value}
                  disabled={isCeo}
                  onChange={e => set("data_scope", e.target.value)}
                  style={{ accentColor: "var(--accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>
          {isCeo && (
            <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 8, fontStyle: "italic" }}>
              CEO role always has access to all data.
            </div>
          )}
        </div>
        <div>
          <label className="input-label">Visible Years</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {config.years.map(y => (
              <label key={y} className="year-chip" style={{
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

      {/* Section 4 -- WhatsApp Permissions */}
      <div className="form-section">
        <div className="form-section-title">WhatsApp Permissions</div>
        <div className="form-grid">
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

      {/* Section 5 -- Dashboard Permissions */}
      <div className="form-section">
        <div className="form-section-title">Dashboard Permissions</div>
        {isCeo && (
          <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 16, fontStyle: "italic" }}>
            CEO always has full dashboard access.
          </div>
        )}
        <div className="perm-grid">
          {DASHBOARD_MODULES.map(m => (
            <label key={m.key} className={`perm-item${isCeo ? " disabled" : ""}`}>
              <input
                type="checkbox"
                checked={isCeo ? true : (perms[m.key] !== false)}
                disabled={isCeo}
                onChange={e => setPermission(m.key, e.target.checked)}
                style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
