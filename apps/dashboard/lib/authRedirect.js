// Safe internal returnTo handling for login redirects (eliza dashboard).

// Build "/login?returnTo=<asPath>" so the user is sent back to where they were
// after a successful login. `asPath` is router.asPath (path + query).
// Never loops back to /login itself.
export function loginUrlWithReturnTo(asPath) {
  if (!asPath || asPath === "/login" || asPath.startsWith("/login?")) {
    return "/login";
  }
  return "/login?returnTo=" + encodeURIComponent(asPath);
}

// Validate a returnTo value before navigating.
// Accept only same-origin internal absolute paths (single leading "/").
// Reject open-redirect vectors: "//evil.com", "https://…", "/\evil", non-internal.
export function safeReturnTo(raw) {
  if (!raw || typeof raw !== "string") return null;
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/")) return null; // must be internal absolute path
  if (decoded.startsWith("//")) return null; // protocol-relative → external
  if (decoded.startsWith("/\\")) return null; // backslash trick → external
  return decoded;
}
