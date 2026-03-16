import Head from "next/head";
import { useState } from "react";
import Nav from "@/components/Nav";
import { useAuth } from "@/lib/auth";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const ACCENT_COLORS = [
  { value: "#C8A97A", label: "Gold" },
  { value: "#4A9EBF", label: "Blue" },
  { value: "#2ECC71", label: "Green" },
  { value: "#9B59B6", label: "Purple" },
  { value: "#E74C3C", label: "Red" },
  { value: "#1ABC9C", label: "Teal" },
];

const TIMEZONES = [
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Casablanca",
  "Africa/Algiers",
  "Asia/Shanghai",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export default function Settings() {
  const { user, logout, getToken, updateSettings } = useAuth();
  const settings = user?.settings || {};

  const theme = settings.theme || "dark";
  const accent = settings.accent_color || "#C8A97A";
  const density = settings.table_density || "comfortable";
  const language = settings.language || "en";
  const timezone = settings.timezone || "Europe/Istanbul";

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(e) {
    e.preventDefault();
    if (newPw.length < 6) {
      setMsg({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg({ type: "success", text: "Password updated successfully" });
      setOldPw("");
      setNewPw("");
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>ELIZA | Settings</title></Head>

      <div className="page">
        <Nav subtitle="Settings" />

        {/* ── PROFILE ── */}
        <div className="settings-section">
          <div className="section-title mb-24">Profile</div>
          <div className="summary-row cols-3">
            <div className="summary-card">
              <div className="summary-label">Name</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{user?.name || "\u2014"}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Role</div>
              <div style={{ fontSize: 16, fontWeight: 500, textTransform: "uppercase" }}>{user?.role || "\u2014"}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Office</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{user?.office || "\u2014"}</div>
            </div>
          </div>
        </div>

        {/* ── APPEARANCE ── */}
        <div className="settings-section">
          <div className="section-title mb-24">Appearance</div>

          <div className="settings-row">
            <div className="settings-label">Theme</div>
            <div className="settings-control">
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={`btn${theme === "dark" ? " active" : ""}`}
                  onClick={() => updateSettings({ theme: "dark" })}
                >
                  Dark
                </button>
                <button
                  className={`btn${theme === "light" ? " active" : ""}`}
                  onClick={() => updateSettings({ theme: "light" })}
                >
                  Light
                </button>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">Accent Color</div>
            <div className="settings-control">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {ACCENT_COLORS.map((c) => (
                  <div
                    key={c.value}
                    onClick={() => updateSettings({ accent_color: c.value })}
                    title={c.label}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: c.value,
                      border: accent === c.value
                        ? "3px solid var(--text-primary)"
                        : "2px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      transform: accent === c.value ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">Table Density</div>
            <div className="settings-control">
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={`btn${density === "comfortable" ? " active" : ""}`}
                  onClick={() => updateSettings({ table_density: "comfortable" })}
                >
                  Comfortable
                </button>
                <button
                  className={`btn${density === "compact" ? " active" : ""}`}
                  onClick={() => updateSettings({ table_density: "compact" })}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── LANGUAGE & REGION ── */}
        <div className="settings-section">
          <div className="section-title mb-24">Language & Region</div>

          <div className="settings-row">
            <div className="settings-label">
              Language
              <span className="coming-soon">Coming Soon</span>
            </div>
            <div className="settings-control">
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { value: "tr", label: "Turkce" },
                  { value: "en", label: "English" },
                  { value: "fr", label: "Francais" },
                ].map((l) => (
                  <button
                    key={l.value}
                    className={`btn${language === l.value ? " active" : ""}`}
                    onClick={() => updateSettings({ language: l.value })}
                    disabled
                    style={{ opacity: language === l.value ? 0.7 : 0.4 }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              Timezone
              <span className="coming-soon">Coming Soon</span>
            </div>
            <div className="settings-control">
              <select
                className="input"
                value={timezone}
                onChange={(e) => updateSettings({ timezone: e.target.value })}
                disabled
                style={{ maxWidth: 280, opacity: 0.5 }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── SECURITY ── */}
        <div className="settings-section">
          <div className="section-title mb-24">Security</div>

          <div style={{ maxWidth: 400 }}>
            {msg && (
              <div style={{
                padding: "10px 14px", borderRadius: 4, marginBottom: 16, fontSize: 13,
                background: msg.type === "error" ? "rgba(192,57,43,0.08)" : "rgba(46,204,113,0.08)",
                border: `1px solid ${msg.type === "error" ? "rgba(192,57,43,0.2)" : "rgba(46,204,113,0.2)"}`,
                color: msg.type === "error" ? "var(--danger)" : "var(--success)",
              }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={changePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="input-label">Current Password</label>
                <input className="input" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required />
              </div>
              <div>
                <label className="input-label">New Password</label>
                <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} />
              </div>
              <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: "flex-start" }}>
                {saving ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
            <button onClick={logout} className="btn-danger" style={{ padding: "10px 24px" }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-section {
          padding-bottom: 32px;
          margin-bottom: 32px;
          border-bottom: 1px solid var(--border);
        }
        .settings-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
        }
        .settings-label {
          font-family: var(--font-sans);
          font-size: 14px;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 160px;
        }
        .settings-control {
          flex: 1;
          display: flex;
          justify-content: flex-end;
        }
        .coming-soon {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-secondary);
          background: var(--surface-2);
          border: 1px solid var(--border);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }
        @media (max-width: 768px) {
          .settings-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .settings-control {
            justify-content: flex-start;
          }
        }
      `}</style>
    </>
  );
}
