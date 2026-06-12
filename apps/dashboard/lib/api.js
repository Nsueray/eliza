// Faz 2a: central auth wrapper for the dashboard.
// Installs a ONE-TIME fetch interceptor (so every existing fetch site is covered
// without rewriting ~15 files) that:
//   - attaches "Authorization: Bearer <eliza_token>" to ELIZA API requests,
//   - on a 401 from a non-/auth API call, clears the token and redirects to
//     /login?returnTo=<current> (LIFFY 1c pattern: token temizle + returnTo).
import { loginUrlWithReturnTo } from "@/lib/authRedirect";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";
const TOKEN_KEY = "eliza_token";

function isApiUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    const base = new URL(API_BASE, window.location.origin);
    return u.origin === base.origin && u.pathname.startsWith(base.pathname);
  } catch {
    return false;
  }
}

function isAuthPath(url) {
  try {
    return new URL(url, window.location.origin).pathname.includes("/api/auth/");
  } catch {
    return false;
  }
}

export function installAuthFetch() {
  if (typeof window === "undefined") return;
  if (window.__elizaAuthFetchInstalled) return;
  window.__elizaAuthFetchInstalled = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url =
      typeof input === "string" ? input : (input && input.url) || "";

    // Leave non-API requests (Next assets, third-party) untouched.
    if (!isApiUrl(url)) return origFetch(input, init);

    const token = window.localStorage.getItem(TOKEN_KEY);
    const headers = new Headers(
      init.headers ||
        (typeof input !== "string" && input ? input.headers : undefined) ||
        {}
    );
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await origFetch(input, { ...init, headers });

    // Session invalid on a protected API call → clear + bounce to login.
    // /auth/* endpoints (login, me) manage their own errors, so skip them.
    if (res.status === 401 && !isAuthPath(url)) {
      window.localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") {
        window.location.assign(
          loginUrlWithReturnTo(window.location.pathname + window.location.search)
        );
      }
    }
    return res;
  };
}
