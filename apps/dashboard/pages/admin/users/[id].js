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
    name: "", email: "", whatsapp_phone: "", language: "tr",
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
    if (!form.name.trim()) { setError("Ad zorunlu"); return; }
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
        throw new Error(data.error || "Güncelleme başarısız");
      }
      router.push("/admin");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!confirm("Bu kullanıcıyı deaktive etmek istediğinize emin misiniz?")) return;
    const res = await fetch(`${API}/users/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
  }

  if (loading || !config) return <div style={{ padding: 48, color: "#5A7080", background: "#080B10", minHeight: "100vh" }}>Yükleniyor...</div>;

  return (
    <>
      <Head><title>ELIZA | Kullanıcı Düzenle</title></Head>
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
            <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 }}>Kullanıcı Düzenle — {form.name}</div>
          </div>
          <Link href="/admin" style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", textDecoration: "none" }}>
            ← Geri
          </Link>
        </div>

        {error && (
          <div style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 4, padding: "12px 16px", marginBottom: 24, color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <UserForm form={form} set={set} toggleYear={toggleYear} config={config} />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={save} disabled={saving} style={{
              fontFamily: '"DM Mono", monospace', fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
              padding: "12px 32px", background: "var(--accent)", color: "var(--bg)", border: "none",
              borderRadius: 4, cursor: "pointer", fontWeight: 500, opacity: saving ? 0.5 : 1,
            }}>
              {saving ? "Kaydediliyor..." : "Güncelle"}
            </button>
            <Link href="/admin" style={{
              fontFamily: '"DM Mono", monospace', fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
              padding: "12px 32px", background: "transparent", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: 4, textDecoration: "none",
              display: "flex", alignItems: "center",
            }}>
              İptal
            </Link>
          </div>
          {form.is_active && (
            <button onClick={deactivate} style={{
              fontFamily: '"DM Mono", monospace', fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
              padding: "12px 32px", background: "rgba(192,57,43,0.1)", color: "var(--danger)",
              border: "1px solid rgba(192,57,43,0.3)", borderRadius: 4, cursor: "pointer",
            }}>
              Deaktive Et
            </button>
          )}
        </div>
      </div>
    </>
  );
}
