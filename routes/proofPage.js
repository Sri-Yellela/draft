// ── D109 P3 · THE PUBLIC PROOF PAGE — GET /p/<handle> ─────────────────────────────────────────────────
//
// An optional page a candidate can put in an application's website field: their projects and the links they supplied
// for each. OFF by default (services/proofLinks.js readProofPage — no row is off). A page that does not exist and a
// page that is turned off answer the SAME 404, so the address cannot be used to learn who has one.
//
// ⛔ NOTHING PRIVATE: the name and the projects only — no email, phone, address, location, experience, or anything
//    from Application defaults (proofPageFor builds the page from those columns and no others).
// ⛔ DRAFT CERTIFIES NOTHING: the page says the links are supplied by the candidate (PROOF_PAGE_NOTE), and nothing on it
//    claims draft checked them (d109NoCertifyWording).
// Server-rendered HTML with no script, so the page works where the client bundle never loads; every value escaped.
import { PROOF_PAGE_NOTE, HANDLE_RE } from "../services/proofLinks.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const day = (t) => (Number(t) > 0 ? new Date(Number(t) * 1000).toISOString().slice(0, 10) : "");
// Only an http(s) address becomes a link (the write paths validate them too — this page never trusts that alone).
const link = (url, label) => (/^https?:\/\//i.test(String(url || "")) ? `<a href="${esc(url)}" rel="nofollow noopener noreferrer" target="_blank">${esc(label)}</a>` : "");

/**
 * ⭐ D178-4 · what they proved in Atlas (only when they switched it on — page.learning is null otherwise). Proof with dates:
 * modules finished, skills passed in a quick check or shown with a build, builds linked. No points, no level, no badge.
 */
export function renderLearning(l) {
  if (!l) return "";
  const rows = [];
  if (l.modules.length) rows.push(`<h3>Modules finished</h3><ul>${l.modules.map(m => `<li>${esc(m.title)} <span class="kind">${day(m.at)}</span></li>`).join("")}</ul>`);
  if (l.skills.length) rows.push(`<h3>Skills</h3><ul>${l.skills.map(s => `<li>${esc(s.name)} <span class="kind">· ${s.how === "built" ? "shown with a build" : "passed a one-minute quick check"} · ${day(s.at)}</span>${s.url ? ` ${link(s.url, "the build")}` : ""}</li>`).join("")}</ul>`);
  if (l.builds.length) rows.push(`<h3>Builds</h3><ul>${l.builds.map(b => `<li>${esc(b.lesson)} <span class="kind">· ${day(b.at)}</span> ${link(b.url, "the build")}</li>`).join("")}</ul>`);
  return `
    <section class="project" data-proof-learning="">
      <h2>Proven in Atlas</h2>
      <p class="none">What they finished and practised in draft's Atlas, each with its date: a module counts when every lesson in it is done; a skill when they passed its quick check or linked a build.</p>
      ${rows.length ? rows.join("") : `<p class="none">Nothing finished in Atlas yet.</p>`}
    </section>`;
}

/** The page's HTML for a proofPageFor() result. Exported for the tests. */
export function renderProofPage(page) {
  const title = page.name ? `${page.name} — projects` : "Projects";
  const projects = page.projects.length
    ? page.projects.map(p => `
    <section class="project">
      <h2>${esc(p.name)}</h2>
      ${p.description ? `<p>${esc(p.description)}</p>` : ""}
      ${p.links.length ? `<ul>${p.links.map(l => `<li><span class="kind">${esc(l.kindLabel)}</span> <a href="${esc(l.url)}" rel="nofollow noopener noreferrer" target="_blank">${esc(l.label)}</a></li>`).join("")}</ul>` : `<p class="none">No links supplied for this project.</p>`}
    </section>`).join("")
    : `<p class="none">No projects listed yet.</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --ink: #1d1f24; --muted: #5d6270; --line: #d9dce3; --bg: #fbfbfc; --accent: #3b5bdb; }
  @media (prefers-color-scheme: dark) { :root { --ink: #e8e9ee; --muted: #a3a8b6; --line: #333845; --bg: #15171c; --accent: #8ea6ff; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 0 0 6px; }
  h3 { font-size: 14px; margin: 12px 0 2px; }
  .project { border-top: 1px solid var(--line); padding: 16px 0; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  a { color: var(--accent); word-break: break-word; }
  .kind { color: var(--muted); font-size: 13px; }
  .none { color: var(--muted); font-size: 13px; }
  footer { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 12px; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>${esc(title)}</h1>
  ${projects}
  ${renderLearning(page.learning)}
  <footer data-proof-note="">${esc(PROOF_PAGE_NOTE)}</footer>
</main>
</body>
</html>`;
}

// ⭐ D183 P3 (owner 11-08): /p/<handle> REDIRECTS (301) to the profile's public page /in/<handle> — its projects and
// "Proven in Atlas" are the public page's Projects and Skills sections now, and a person who had this page ON starts
// Public for those two sections (migration 245). renderProofPage stays for the tests that pin what it never shows.
export default function proofPageRoutes(app, db) {
  app.get("/p/:handle", (req, res) => {
    const h = String(req.params.handle || "").trim().toLowerCase();
    if (HANDLE_RE.test(h)) return res.redirect(301, `/in/${h}`);
    res.set("X-Robots-Tag", "noindex");
    return res.status(404).type("html").send(`<!doctype html><meta charset="utf-8"><title>Not found</title><p>There is no page at this address.</p>`);
  });
}

