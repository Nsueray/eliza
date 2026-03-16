import Head from "next/head";
import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password, remember);
      router.replace("/");
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>ELIZA | Login</title>
      </Head>

      <div className="login-page">
        <div className="login-box">
          <div className="login-brand">
            ELIZA<span className="dot">.</span>
          </div>
          <div className="login-subtitle">CEO Operating System</div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="input-label" htmlFor="identifier">
                Phone or Email
              </label>
              <input
                id="identifier"
                className="input"
                type="text"
                placeholder="suer@elan-expo.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="login-field">
              <label className="input-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="login-remember">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  Remember me
                </span>
              </label>
            </div>

            <button type="submit" className="btn-primary login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="login-footer">Elan Expo &copy; 2026</div>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
        }
        .login-box {
          width: 100%;
          max-width: 380px;
          padding: 0 24px;
        }
        .login-brand {
          font-family: var(--font-mono);
          font-size: 42px;
          font-weight: 500;
          letter-spacing: 10px;
          text-align: center;
          color: var(--text-primary);
        }
        .login-brand .dot { color: var(--accent); }
        .login-subtitle {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--text-secondary);
          text-align: center;
          margin-top: 4px;
          margin-bottom: 48px;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .login-field {
          display: flex;
          flex-direction: column;
        }
        .login-error {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--danger);
          background: rgba(192,57,43,0.08);
          border: 1px solid rgba(192,57,43,0.2);
          border-radius: var(--radius);
          padding: 10px 14px;
          text-align: center;
        }
        .login-remember {
          margin-top: -8px;
        }
        .login-btn {
          width: 100%;
          margin-top: 4px;
        }
        .login-footer {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
          letter-spacing: 2px;
          text-align: center;
          margin-top: 48px;
          opacity: 0.5;
        }
      `}</style>
    </>
  );
}
