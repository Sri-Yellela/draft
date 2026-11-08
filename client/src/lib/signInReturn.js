// ⭐ A138 (owner 11-07): every sign-in returns the person to the page they signed in from.
// One rule, used by the header's sign-in panel, the /login screen, the signed-in route gate and every
// "Sign in" link: the return path is a same-origin PATH ("/…", never "//…" or a full URL), never the
// sign-in pages themselves, and defaults to /app. The server applies the same rule again
// (server.js oauthReturnUrl) — this copy only decides what to ask for.

const SIGN_IN_PATHS = /^\/(login|register)(\/|$|\?|#)/;

/** A safe return path, or null. */
export function safeReturnPath(raw) {
  const s = String(raw || "");
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return null;
  if (SIGN_IN_PATHS.test(s)) return null;
  return s;
}

/** The `returnTo` asked for in a query string (the /login screen's), or null. */
export function returnToFromSearch(search) {
  return safeReturnPath(new URLSearchParams(search || "").get("returnTo"));
}

/** Where the person is now — what a sign-in started here should come back to. */
export function currentReturnPath(loc = typeof window !== "undefined" ? window.location : null) {
  if (!loc) return "/app";
  const here = `${loc.pathname || "/"}${loc.search || ""}${loc.hash || ""}`;
  // On /login itself, keep whatever /login was asked to return to.
  if (SIGN_IN_PATHS.test(loc.pathname || "")) return returnToFromSearch(loc.search) || "/app";
  return safeReturnPath(here) || "/app";
}

/** /login, carrying where to come back to. */
export function loginHref(returnTo = currentReturnPath()) {
  const safe = safeReturnPath(returnTo);
  return safe && safe !== "/app" ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login";
}

/** The provider's start URL, carrying where to come back to. */
export function providerStartHref(provider, returnTo = currentReturnPath()) {
  const safe = safeReturnPath(returnTo) || "/app";
  return `/auth/${encodeURIComponent(provider)}?returnTo=${encodeURIComponent(safe)}`;
}
