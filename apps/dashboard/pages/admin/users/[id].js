import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { UserForm } from "./new";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";

export default function EditUser() {
  const router = useRouter();
  const { id } = router.query;
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "", email: "", whatsapp_phone: "", language: "tr", nicknames: "",
    role: "agent", office: "", sales_group: "", sales_agent_name: "", is_manager: false,
    data_scope: "own", visible_years: [2025, 2026],
    can_see_expenses: false, can_take_notes: false, can_use_message_generator: false, can_see_financials: false,
    is_active: true,
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

  async function deactivate() {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    const res = await fetch(`${API}/users/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
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

        <UserForm form={form} set={set} toggleYear={toggleYear} config={config} />

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
