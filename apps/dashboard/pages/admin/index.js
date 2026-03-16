import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";

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

      <div className="page">
        <Nav subtitle="Admin Panel" />

        {/* Actions */}
        <div className="flex-between mb-24">
          <div className="section-title">
            Users ({users.filter(u => u.is_active).length} active)
          </div>
          <Link href="/admin/users/new" className="btn-primary" style={{ textDecoration: "none" }}>
            + New User
          </Link>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                {["Name", "Email", "WhatsApp", "Role", "Office", "Scope", "Status", "Actions"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.45 }}>
                  <td>
                    {u.name}
                    {u.is_manager && <span className="badge badge-accent" style={{ marginLeft: 6, fontSize: 9 }}>MGR</span>}
                  </td>
                  <td className="muted text-sm">{u.email || "\u2014"}</td>
                  <td className="mono muted text-sm">{u.whatsapp_phone || "\u2014"}</td>
                  <td>
                    <span className="badge" style={{
                      color: ROLE_COLORS[u.role] || "var(--text-secondary)",
                      background: `${ROLE_COLORS[u.role] || "var(--text-secondary)"}15`,
                      border: `1px solid ${ROLE_COLORS[u.role] || "var(--text-secondary)"}40`,
                    }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="muted text-sm">{u.office || "\u2014"}</td>
                  <td className="mono muted text-xs">{u.data_scope || "own"}</td>
                  <td>
                    <span className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}>
                      {u.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/admin/users/${u.id}`} className="btn-sm" style={{ textDecoration: "none" }}>
                        Edit
                      </Link>
                      {u.is_active ? (
                        <button onClick={() => deactivateUser(u.id, u.name)} className="btn-danger" style={{ padding: "4px 12px" }}>
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => reactivateUser(u.id)} className="btn-success" style={{ padding: "4px 12px" }}>
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
