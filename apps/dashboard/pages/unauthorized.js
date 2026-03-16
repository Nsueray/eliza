import Head from "next/head";
import Link from "next/link";

export default function Unauthorized() {
  return (
    <>
      <Head><title>ELIZA | Access Denied</title></Head>
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: "0 24px" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 42,
            fontWeight: 500,
            letterSpacing: 10,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}>
            ELIZA<span style={{ color: "var(--accent)" }}>.</span>
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "var(--danger)",
            marginTop: 24,
            marginBottom: 16,
          }}>
            Access Denied
          </div>
          <div style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 32,
          }}>
            You do not have permission to access this page. Contact your administrator.
          </div>
          <Link href="/" style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--accent)",
            textDecoration: "none",
          }}>
            &larr; Go Back
          </Link>
        </div>
      </div>
    </>
  );
}
