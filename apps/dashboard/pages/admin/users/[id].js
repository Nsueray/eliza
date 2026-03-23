import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { UserForm, ROLE_PERM_DEFAULTS } from "./new";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const PUSH_TYPE_LABELS = {
  morning_brief: { label: "Morning Brief", desc: "Alerts + yesterday stats", default_time: "08:00" },
  midday_pulse: { label: "Midday Pulse", desc: "Today's progress", default_time: "13:00" },
  daily_wrap: { label: "Daily Wrap", desc: "End-of-day summary", default_time: "16:00" },
  weekly_report: { label: "Weekly Report", desc: "Monday — week overview", default_time: "08:00" },
  weekly_close: { label: "Weekly Close", desc: "Friday — week close", default_time: "16:00" },
};

const TIME_OPTIONS = [];
for (let h = 7; h <= 20; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function PushSettings({ pushSettings, onChange, userId, onTest, pushTest, setPushTest }) {
  const ps = pushSettings || {};

  function toggleType(type) {
    const current = ps[type] || {};
    const defaultTime = PUSH_TYPE_LABELS[type].default_time;
    onChange({
      ...ps,
      [type]: {
        enabled: !current.enabled,
        time: current.time || defaultTime,
      },
    });
  }

  function setTime(type, time) {
    const current = ps[type] || {};
    onChange({
      ...ps,
      [type]: { ...current, time },
    });
  }

  function setScope(scope) {
    onChange({ ...ps, scope });
  }

  const sectionStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 24, marginBottom: 24,
    boxShadow: "var(--card-shadow)",
  };

  const rowStyle = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 0", borderBottom: "1px solid var(--border)",
  };

  return (
    <div style={sectionStyle}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
        Push Notifications
      </div>

      {Object.entries(PUSH_TYPE_LABELS).map(([type, info]) => {
        const setting = ps[type] || {};
        const enabled = !!setting.enabled;
        const time = setting.time || info.default_time;
        return (
          <div key={type} style={rowStyle}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleType(type)}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{info.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{info.desc}</div>
              </div>
            </label>
            <select
              className="input"
              value={time}
              onChange={e => setTime(type, e.target.value)}
              disabled={!enabled}
              style={{ width: 100, padding: "6px 8px", fontSize: 13, opacity: enabled ? 1 : 0.4 }}
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        );
      })}

      <div style={{ ...rowStyle, borderBottom: "none", paddingTop: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Data Scope</div>
          <select
            className="input"
            value={ps.scope || "all"}
            onChange={e => setScope(e.target.value)}
            style={{ width: 160, padding: "6px 8px", fontSize: 13 }}
          >
            <option value="all">All (company-wide)</option>
            <option value="team">Team only</option>
            <option value="own">Own data only</option>
          </select>
        </div>
      </div>

      {/* Test Push */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="input"
            value={pushTest.type}
            onChange={e => setPushTest(prev => ({ ...prev, type: e.target.value, result: null }))}
            style={{ width: 180, padding: "6px 8px", fontSize: 13 }}
          >
            {Object.entries(PUSH_TYPE_LABELS).map(([type, info]) => (
              <option key={type} value={type}>{info.label}</option>
            ))}
          </select>
          <button
            className="btn-sm"
            onClick={onTest}
            disabled={pushTest.loading}
            style={{ padding: "6px 16px", fontSize: 12, whiteSpace: "nowrap" }}
          >
            {pushTest.loading ? "Generating..." : "Test Preview"}
          </button>
        </div>
        {pushTest.result && (
          <pre style={{
            marginTop: 12, padding: 12, background: "var(--surface-2)",
            border: "1px solid var(--border)", borderRadius: 4,
            fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap",
            maxHeight: 300, overflowY: "auto", color: "var(--text)",
          }}>
            {pushTest.result.error || pushTest.result.messageText || JSON.stringify(pushTest.result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function EditUser() {
  const router = useRouter();
  const { id } = router.query;
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const [pushTest, setPushTest] = useState({ loading: false, result: null, type: "morning_brief" });

  const [form, setForm] = useState({
    name: "", email: "", whatsapp_phone: "", language: "tr", nicknames: "",
    role: "agent", office: "", sales_group: "", sales_agent_name: "", is_manager: false,
    data_scope: "own", visible_years: [2025, 2026],
    can_see_expenses: false, can_take_notes: false, can_use_message_generator: false, can_see_financials: false,
    is_active: true,
    dashboard_permissions: {},
    push_settings: {},
  });

  useEffect(() => {
    fetch(`${API}/users/config`).then(r => r.json()).then(setConfig);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/users/${id}`)
      .then(r => r.json())
      .then(user => {
        setForm({
          name: user.name || "",
          email: user.email || "",
          whatsapp_phone: user.whatsapp_phone || "",
          language: user.language || "tr",
          nicknames: user.nicknames || "",
          role: user.role || "agent",
          office: user.office || "",
          sales_group: user.sales_group || "",
          sales_agent_name: user.sales_agent_name || "",
          is_manager: user.is_manager || false,
          data_scope: user.data_scope || "own",
          visible_years: user.visible_years || [2025, 2026],
          can_see_expenses: user.can_see_expenses || false,
          can_take_notes: user.can_take_notes || false,
          can_use_message_generator: user.can_use_message_generator || false,
          can_see_financials: user.can_see_financials || false,
          is_active: user.is_active,
          dashboard_permissions: user.dashboard_permissions || ROLE_PERM_DEFAULTS[user.role] || {},
          push_settings: user.push_settings || {},
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  function set(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === "role") {
        const scopes = { ceo: "all", manager: "team", agent: "own" };
        next.data_scope = scopes[val] || "own";
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
      const res = await fetch(`${API}/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Update failed");
      }
      router.push("/admin");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function setPasswordFn() {
    if (!password || password.length < 6) { setPwMsg({ type: "error", text: "Minimum 6 characters" }); return; }
    setPwSaving(true);
    setPwMsg(null);
    try {
      const res = await fetch(`${API}/users/${id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setPassword("");
      setPwMsg({ type: "success", text: "Password updated" });
      setTimeout(() => setPwMsg(null), 3000);
    } catch (err) {
      setPwMsg({ type: "error", text: err.message });
    }
    setPwSaving(false);
  }

  async function deactivate() {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    const res = await fetch(`${API}/users/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
  }

  async function testPushFn() {
    setPushTest(prev => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch(`${API}/system/test-push?user_id=${id}&type=${pushTest.type}`);
      const data = await res.json();
      setPushTest(prev => ({ ...prev, loading: false, result: data }));
    } catch (err) {
      setPushTest(prev => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  }

  if (loading || !config) return <div className="loading" style={{ marginTop: "40vh" }}>Loading...</div>;

  return (
    <>
      <Head><title>ELIZA | Edit User</title></Head>

      <div className="page" style={{ maxWidth: 800 }}>
        <div className="page-hdr">
          <div>
            <div className="page-brand">ELIZA<span className="dot">.</span></div>
            <div className="page-sub">Edit User &mdash; {form.name}</div>
          </div>
          <Link href="/admin" className="nav-link">&larr; Back</Link>
        </div>

        {error && (
          <div style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 4, padding: "12px 16px", marginBottom: 24, color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <UserForm form={form} set={set} toggleYear={toggleYear} config={config} setPermission={setPermission} />

        {/* Push Notifications */}
        <PushSettings
          pushSettings={form.push_settings}
          onChange={ps => setForm(prev => ({ ...prev, push_settings: ps }))}
          userId={id}
          onTest={testPushFn}
          pushTest={pushTest}
          setPushTest={setPushTest}
        />

        {/* Set Password */}
        <div className="form-section" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, marginBottom: 24, boxShadow: "var(--card-shadow)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>Set Password</div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
              />
            </div>
            <button onClick={setPasswordFn} disabled={pwSaving} className="btn-primary" style={{ whiteSpace: "nowrap" }}>
              {pwSaving ? "Saving..." : "Set Password"}
            </button>
          </div>
          {pwMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: pwMsg.type === "success" ? "var(--success)" : "var(--danger)" }}>
              {pwMsg.text}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Update"}
            </button>
            <Link href="/admin" className="btn" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              Cancel
            </Link>
          </div>
          {form.is_active && (
            <button onClick={deactivate} className="btn-danger" style={{ padding: "10px 24px" }}>
              Deactivate
            </button>
          )}
        </div>
      </div>
    </>
  );
}
