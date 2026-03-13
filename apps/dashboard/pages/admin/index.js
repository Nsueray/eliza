import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

const ROLE_LABELS = { ceo: "CEO", manager: "Manager", agent: "Agent" };
const ROLE_COLORS = {
  ceo: "#C8A97A",
  manager: "#4A9EBF",
  agent: "#5A7080",
};

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/users`)
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deactivateUser(id, name) {
    if (!confirm(`Are you sure you want to deactivate ${name}?`)) return;
    const res = await fetch(`${API}/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: false } : u));
    }
  }

  async function reactivateUser(id) {
    const res = await fetch(`${API}/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: true } : u));
    }
  }

  return (
    <>
      <Head><title>ELIZA | Admin</title></Head>
      <style jsx global>{`
        :root {
          --bg: #080B10; --surface: #0E1318; --surface-2: #141B22;
          --border: #1E2A35; --text-primary: #E8EDF2; --text-secondary: #5A7080;
          --accent: #C8A97A; --accent-2: #4A9EBF;
          --danger: #C0392B; --warning: #D4A017; --success: #2ECC71;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--bg); color: var(--text-primary); font-family: "DM Sans", -apple-system, sans-serif; min-height: 100vh; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 24, borderBottom: "1px solid var(--accent)", marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 28, fontWeight: 500, letterSpacing: 6 }}>
              ELIZA<span style={{ color: "var(--accent)" }}>.</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>Admin Panel</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/admin/logs" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>Logs</Link>
            <Link href="/admin/intelligence" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>Intelligence</Link>
            <Link href="/admin/system" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>System</Link>
            <Link href="/admin" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Users</Link>
            <Link href="/" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>War Room →</Link>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase" }}>
            Users ({users.filter(u => u.is_active).length} active)
          </div>
          <Link href="/admin/users/new" style={{
            fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
            padding: "8px 20px", background: "var(--accent)", color: "var(--bg)", borderRadius: 4, textDecoration: "none", fontWeight: 500,
          }}>
            + New User
          </Link>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)" }}>Loading...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <thead>
              <tr>
                {["Name", "Email", "WhatsApp", "Role", "Office", "Scope", "Status", "Actions"].map(h => (
                  <th key={h} style={{
                    fontFamily: '"DM Mono", monospace', fontSize: 10, color: "var(--text-secondary)",
                    letterSpacing: 1.5, textTransform: "uppercase", textAlign: "left",
                    padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.45 }}>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    {u.name}
                    {u.is_manager && <span style={{ fontSize: 9, color: "var(--accent)", marginLeft: 6, fontFamily: '"DM Mono", monospace' }}>MGR</span>}
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>{u.email || "—"}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>{u.whatsapp_phone || "—"}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{
                      fontFamily: '"DM Mono", monospace', fontSize: 10, fontWeight: 500, letterSpacing: 1,
                      padding: "3px 8px", borderRadius: 3, color: ROLE_COLORS[u.role] || "var(--text-secondary)",
                      background: `${ROLE_COLORS[u.role] || "var(--text-secondary)"}15`,
                      border: `1px solid ${ROLE_COLORS[u.role] || "var(--text-secondary)"}40`,
                    }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>{u.office || "—"}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>{u.data_scope || "own"}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{
                      fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: 1, padding: "3px 8px", borderRadius: 3,
                      color: u.is_active ? "var(--success)" : "var(--danger)",
                      background: u.is_active ? "rgba(46,204,113,0.1)" : "rgba(192,57,43,0.1)",
                      border: `1px solid ${u.is_active ? "rgba(46,204,113,0.3)" : "rgba(192,57,43,0.3)"}`,
                    }}>
                      {u.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/admin/users/${u.id}`} style={{
                        fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: 1,
                        padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 3,
                        color: "var(--text-secondary)", textDecoration: "none", background: "transparent",
                      }}>
                        Edit
                      </Link>
                      {u.is_active ? (
                        <button onClick={() => deactivateUser(u.id, u.name)} style={{
                          fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: 1,
                          padding: "4px 12px", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 3,
                          color: "var(--danger)", background: "transparent", cursor: "pointer",
                        }}>
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => reactivateUser(u.id)} style={{
                          fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: 1,
                          padding: "4px 12px", border: "1px solid rgba(46,204,113,0.3)", borderRadius: 3,
                          color: "var(--success)", background: "transparent", cursor: "pointer",
                        }}>
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
