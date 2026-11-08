// ⭐ D179 P4b (45l) · a company's page address from its name — the SAME rule the server's records use
// (services/jobs/companyLogoStore.js companyKey: lower-case, legal forms dropped, one hyphen between words). A company
// whose slug took a "-2" on a collision is still found: the server resolves the plain key through the record's name alias.
const LEGAL = /\b(inc|llc|ltd|limited|corp|corporation|co|company|the|plc|gmbh|sa|ag|bv)\b\.?/g;

export function companySlug(name) {
  return String(name || "").toLowerCase().replace(LEGAL, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** The company page's path — inside the shell under /app, else the public page. */
export function companyPath(name, { inApp = true } = {}) {
  const slug = companySlug(name);
  return slug ? `${inApp ? "/app" : ""}/companies/${slug}` : null;
}
