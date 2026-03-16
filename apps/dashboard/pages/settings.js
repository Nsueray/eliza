import Head from "next/head";
import { useState } from "react";
import Nav from "@/components/Nav";
import { useAuth } from "@/lib/auth";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

export default function Settings() {
  const { user, logout, getToken } = useAuth();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(e) {
    e.preventDefault();
    if (newPw.length < 6) { setMsg({ type: "error", text: "Password must be at least 6 characters" }); return; }
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

        {/* User Info */}
        <div className="summary-row cols-3" style={{ marginBottom: 40 }}>
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

        {/* Change Password */}
        <div style={{ maxWidth: 400 }}>
          <div className="section-title mb-24">Change Password</div>

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
              <input className="input" type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} required />
            </div>
            <div>
              <label className="input-label">New Password</label>
              <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: "flex-start" }}>
              {saving ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Logout */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          <button onClick={logout} className="btn-danger" style={{ padding: "10px 24px" }}>
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
