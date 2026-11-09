// ⭐ D179 P4b (45l) · a company's page address from its name — the SAME rule the server's records use
// (services/jobs/companyLogoStore.js companyKey: lower-case, legal forms dropped, one hyphen between words). A company
// whose slug took a "-2" on a collision is still found: the server resolves the plain key through the record's name alias.
// ⭐ A157 (45q): the rule itself lives in shared/companyPaths.js — the server's sitemaps and redirects use the same one.
import { companySlug, companyPagePathFromSlug } from "../../../shared/companyPaths.js";
export { companySlug };

/**
 * The company page's path — inside the shell under /app (the dock stays; Back returns), else its own public address
 * /<company> (A157, owner 11-09). `job` = the posting the reader came from: the page puts it first with its Apply link.
 */
export function companyPath(name, { inApp = true, job = null } = {}) {
  const slug = companySlug(name);
  if (!slug) return null;
  const q = job ? `?job=${encodeURIComponent(job)}` : "";
  return `${inApp ? `/app/companies/${slug}` : companyPagePathFromSlug(slug)}${q}`;
}
