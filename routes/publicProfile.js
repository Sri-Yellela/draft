// ── D183 P3 · THE PUBLIC PROFILE PAGE — GET /in/<handle> (owner 11-08; spec docs/sketches/Profile redesign.html, board 2) ─
//
// Server-rendered, no script, works signed out. It draws EXACTLY services/profilePage.js viewFor(page, 'public') — the
// same filter "View as the public" shows the owner — so a section the person did not make public is never in the HTML.
//   · PRIVATE (the default): the address answers "This profile is private." — the same words for every private page.
//   · No handle at that address: the same 404 as before (the address cannot be used to learn who has one).
//   · noindex BY DEFAULT: `<meta name="robots" content="noindex">` and X-Robots-Tag, unless the person switched on
//     "Let search engines find it" AND the page is Public.
//   · ⛔ Never on it: email, phone, address, application defaults, job profiles, saved answers (they are not sections).
//   · Skills as "Proven on draft" (with the date, and *see it* for a build) + "Also lists"; the line that says what
//     proven means — "not a certification". Links as GitHub / LinkedIn marks.
//   · Connect · Message wait for D180; until then a Share line (the address). Report this profile → profile_reports
//     (the moderation queue; at most REPORTS_PER_DAY from one sender a day). Admin reads / resolves it at
//     /api/admin/profile-reports.
//   · /p/<handle> (D109's proof page) answers 301 → /in/<handle> (routes/proofPage.js).
import { profileViewerFor, networkEnabled } from "../services/network/connections.js";   // D180 P1: a connection's view
import { durationLabel } from "../shared/durationLabel.js";   // A153 (45o): "2 yrs 4 mos" on the public page too
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { profilePage, viewFor } from "../services/profilePage.js";
import { experienceEntities } from "../services/entities.js";   // (12) 45q · D184 B-6 on the public page too
import { HANDLE_RE } from "../services/proofLinks.js";
import { sniffImage } from "../services/accountService.js";

export const REPORT_REASONS = Object.freeze([
  ["fake", "Fake profile or impersonation"],
  ["offensive", "Offensive or harmful content"],
  ["spam", "Spam or advertising"],
  ["private", "It shows someone's private information"],
  ["other", "Something else"],
]);
export const REPORTS_PER_DAY = 5;
export const PROVEN_NOTE = "“Proven on draft” means a check passed or a build linked, with its date — not a certification.";
const PRIVATE_LINE = "This profile is private.";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const day = (t) => (Number(t) > 0 ? new Date(Number(t) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");
const href = (url) => (/^https?:\/\//i.test(String(url || "")) ? esc(url) : null);
const ymLabel = (ym) => { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || "")); return m ? m[1] : ""; };
const MARK = {
  github: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  web: null,
};
const SITE = { github: "GitHub", linkedin: "LinkedIn" };

/** The user behind a handle (any proof_pages row with that handle), or null. */
export function userForHandle(db, handle) {
  const h = String(handle ?? "").trim().toLowerCase();
  if (!HANDLE_RE.test(h)) return null;
  try { return db.prepare(`SELECT user_id, handle FROM proof_pages WHERE handle = ?`).get(h) || null; } catch { return null; }
}

/** What /in/<handle> shows: { status: 404 | 200, view?, handle } — view.private when the page is not public. */
export function publicViewFor(db, handle, { viewerId = null } = {}) {
  const row = userForHandle(db, handle);
  if (!row) return { status: 404 };
  // ⭐ D180 P1 (45o): a CONNECTED signed-in viewer sees the page's Connections sections (D183's level) — only while the
  // network is on; everyone else (and the owner here) gets exactly the public view, as before.
  const who = profileViewerFor(db, viewerId, row.user_id);
  const view = viewFor(profilePage(db, row.user_id), who === "connection" ? "connection" : "public");
  return { status: 200, view, handle: row.handle, userId: row.user_id };
}

/** Index the page only when the person said yes AND the page is public. */
export const indexable = (view) => !!view && !view.private && view.searchable === true;

const shell = ({ title, body, index }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${index ? "" : `<meta name="robots" content="noindex">\n`}<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --ink: #1d1f24; --muted: #5d6270; --line: #d9dce3; --bg: #fbfbfc; --card: #ffffff; --accent: #3b5bdb; --cover: #dfe5fb; }
  @media (prefers-color-scheme: dark) { :root { --ink: #e8e9ee; --muted: #a3a8b6; --line: #333845; --bg: #15171c; --card: #1c1f26; --accent: #8ea6ff; --cover: #262d45; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header.top { display: flex; justify-content: space-between; align-items: center; max-width: 820px; margin: 0 auto; padding: 14px 16px; }
  header.top a { color: var(--ink); text-decoration: none; font-weight: 700; }
  header.top nav a { font-weight: 500; margin-left: 16px; color: var(--muted); }
  main { max-width: 820px; margin: 0 auto; padding: 0 16px 48px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 16px 20px; margin-bottom: 14px; }
  .head { padding: 0 20px 18px; overflow: hidden; }
  .cover { height: 96px; margin: 0 -20px; background: var(--cover); }
  .avatar { width: 88px; height: 88px; border-radius: 50%; border: 4px solid var(--card); margin-top: -44px; object-fit: cover; background: var(--cover);
    display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 700; color: var(--muted); box-sizing: border-box; }
  h1 { font-size: 24px; margin: 8px 0 2px; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  .muted { color: var(--muted); font-size: 13.5px; }
  .open { color: var(--accent); font-weight: 600; font-size: 14px; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .role { margin-bottom: 12px; }
  .logo { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--line); object-fit: contain; vertical-align: middle; margin-right: 8px; }
  .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  @media (max-width: 640px) { .cols { grid-template-columns: 1fr; } }
  a { color: var(--accent); word-break: break-word; }
  .links a { display: inline-flex; align-items: center; gap: 6px; margin-right: 16px; color: var(--ink); text-decoration: none; }
  .links svg { width: 18px; height: 18px; }
  form.report { display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
  form.report select, form.report textarea, form.report button { font: inherit; padding: 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); }
  details summary { cursor: pointer; color: var(--muted); }
</style>
</head>
<body>
<header class="top"><a href="/">draft</a><nav><a href="/jobs">Jobs</a><a href="/atlas">Atlas</a><a href="/login">Sign in</a><a href="/register" data-get-started="">Get started</a></nav></header>
<main>
${body}
</main>
</body>
</html>`;

function linkMark(url, name) {
  const u = href(url);
  if (!u) return "";
  let host = ""; try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { /* shown plain */ }
  const kind = host === "github.com" || host.endsWith(".github.com") ? "github" : host === "linkedin.com" || host.endsWith(".linkedin.com") ? "linkedin" : "web";
  const label = String(url).replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");
  const aria = SITE[kind] ? `${name || "This person"} on ${SITE[kind]}` : `${name ? `${name}'s` : "A"} link: ${host}`;
  const icon = MARK[kind]
    ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${MARK[kind]}"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`;
  return `<a href="${u}" rel="nofollow noopener noreferrer me" target="_blank" aria-label="${esc(aria)}" data-link-mark="${kind}">${icon}<span>${esc(label)}</span></a>`;
}

function reportForm(handle) {
  return `<details class="card" data-report="">
  <summary>Report this profile</summary>
  <form class="report" method="post" action="/in/${esc(handle)}/report">
    <label>Why? <select name="reason" required>${REPORT_REASONS.map(([k, w]) => `<option value="${k}">${esc(w)}</option>`).join("")}</select></label>
    <label>Anything else (optional) <textarea name="details" rows="3" maxlength="1000"></textarea></label>
    <button type="submit">Send the report</button>
    <span class="muted">Reports go to draft's moderators. The person is not told who sent one.</span>
  </form>
</details>`;
}

/** The page's HTML for a publicViewFor() result. Exported for the tests. */
/**
 * (12) 45q · D184 B-6 on the PUBLIC page: an experience row's employer is the shared company object — a link to its PUBLIC
 * company page (/companies/<slug>), and the stack its own postings show with what this row names ("used React, TypeScript
 * there"). An employer with no record stays plain text, no stack — never a guess.
 */
export function companyLine(x) {
  const r = x?.companyRef;
  if (!r?.slug) return esc(x?.company || "");
  const used = (r.used || []).slice(0, 4);
  const stack = (r.stack || []).slice(0, 6);
  return `<a href="/companies/${encodeURIComponent(r.slug)}" data-company-link="">${esc(x.company || r.name)}</a>`
    + (stack.length ? `<div class="muted" data-company-stack="">${esc(r.name)} works with ${esc(stack.join(", "))}${used.length ? ` — used ${esc(used.join(", "))} there` : ""}</div>` : "");
}

export function renderPublicProfile({ view, handle }, { origin = "", connect = false } = {}) {
  if (view.private) {
    return shell({ title: "Private profile", index: false,
      body: `<section class="card" data-private=""><h1>${esc(PRIVATE_LINE)}</h1><p class="muted">Its owner has not made it public.</p></section>` });
  }
  const h = view.header, s = view.sections;
  const name = h.name || "A draft member";
  const open = [h.openToWork ? "Open to work" : null, h.openToWork && h.area ? esc(h.area).toLowerCase() : null, h.referrals ? "referrals welcome" : null].filter(Boolean).join(" · ");
  const parts = [];
  parts.push(`<section class="card head" data-public-header="">
  <div class="cover" aria-hidden="true"></div>
  ${h.avatar ? `<img class="avatar" src="/in/${esc(handle)}/photo" alt="">` : `<div class="avatar" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</div>`}
  <h1>${esc(name)}</h1>
  ${h.headline ? `<div>${esc(h.headline)}</div>` : ""}
  ${h.location ? `<div class="muted">${esc(h.location)}</div>` : ""}
  ${open ? `<div class="open">${open}</div>` : ""}
  <p class="muted" data-share="">Share: <a href="/in/${esc(handle)}">${esc(`${origin.replace(/^https?:\/\//, "")}/in/${handle}`)}</a></p>
  ${connect ? `<p data-connect=""><a href="/app/network?connect=${encodeURIComponent(handle)}">Connect on draft</a> <span class="muted">— a request they can accept or ignore</span></p>` : ""}
</section>`);
  if (s.about?.summary) parts.push(`<section class="card" data-section="about"><h2>About</h2><p>${esc(s.about.summary)}</p></section>`);
  if (s.experience?.items?.length) parts.push(`<section class="card" data-section="experience"><h2>Experience</h2>${s.experience.items.map(x => `
  <div class="role">${x.logo ? `<img class="logo" src="${esc(x.logo)}" alt="">` : ""}<b>${esc(x.title || "")}</b><div>${companyLine(x)}</div>
    <div class="muted">${[ymLabel(x.start), x.current ? "now" : ymLabel(x.end)].filter(Boolean).join(" – ")}${durationLabel(x.start, x.current ? null : x.end) ? ` · ${esc(durationLabel(x.start, x.current ? null : x.end))}` : ""}${x.location ? ` · ${esc(x.location)}` : ""}</div>
    ${(x.bullets || []).length ? `<ul>${x.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</section>`);
  if (s.skills) parts.push(`<section class="card" data-section="skills"><h2>Skills</h2><div class="cols">
  <div><b>Proven on draft</b>${s.skills.proven.length ? `<ul>${s.skills.proven.map(p => `<li>${esc(p.name)} <span class="muted">· ${p.how === "built" ? "built something" : "passed a skill check"}${href(p.url) ? ` · <a href="${href(p.url)}" rel="nofollow noopener noreferrer" target="_blank">see it</a>` : ""}${p.at ? ` · ${day(p.at)}` : ""}</span></li>`).join("")}</ul>` : `<p class="muted">Nothing proven on draft yet.</p>`}</div>
  <div><b>Also lists</b><p>${s.skills.fromResume.map(x => esc(x.name)).join(" · ") || `<span class="muted">—</span>`}</p></div>
  </div><p class="muted" data-proven-note="">${esc(PROVEN_NOTE)}</p></section>`);
  if (s.fit && !s.fit.thin && s.fit.ready != null) parts.push(`<section class="card" data-section="fit"><h2>Where they fit</h2><p>${esc(s.fit.ready)}% ready for ${esc(s.fit.role)}</p><p class="muted">${esc(s.fit.scope || "")}</p></section>`);
  if (s.projects?.items?.length) parts.push(`<section class="card" data-section="projects"><h2>Projects</h2><ul>${s.projects.items.map(p => `<li><b>${esc(p.name)}</b>${p.description ? ` — ${esc(p.description)}` : ""}${(p.evidence || []).map(e => href(e.url) ? ` · <a href="${href(e.url)}" rel="nofollow noopener noreferrer" target="_blank">${esc(e.label || e.url)}</a>` : "").join("")}</li>`).join("")}</ul></section>`);
  if (s.achievements?.items?.length) parts.push(`<section class="card" data-section="achievements"><h2>Achievements</h2><ul>${s.achievements.items.map(a => `<li>${esc(a.title)}${a.year ? ` · ${esc(a.year)}` : a.at ? ` · ${day(a.at)}` : ""}${a.source === "atlas" ? ` <span class="muted">· finished on draft</span>` : ""}</li>`).join("")}</ul></section>`);
  if (s.education?.items?.length) parts.push(`<section class="card" data-section="education"><h2>Education</h2><ul>${s.education.items.map(e => `<li>${e.logo ? `<img class="logo" src="${esc(e.logo)}" alt="">` : ""}<b>${esc(e.school)}</b>${[e.degree, e.field].filter(Boolean).length ? ` — ${esc([e.degree, e.field].filter(Boolean).join(", "))}` : ""}${e.end ? ` · ${esc(ymLabel(e.end))}` : ""}</li>`).join("")}</ul></section>`);
  if (s.links?.items?.length) parts.push(`<section class="card links" data-section="links"><h2>Links</h2>${s.links.items.map(l => linkMark(l.url, name)).join("")}</section>`);
  parts.push(`<section class="card" data-not-shown=""><b>Not shown to the public</b><p class="muted">Contact details, readiness for a role, job profiles, saved answers and application defaults — ${esc(name.split(" ")[0])} chose who sees each section.</p></section>`);
  parts.push(reportForm(handle));
  return shell({ title: `${name}${h.headline ? ` — ${h.headline}` : ""}`, index: indexable(view), body: parts.join("\n") });
}

/** Record a report (rate-limited per sender a day). Returns true when stored. */
export function fileReport(db, { userId, handle, reason, details, reporterUserId = null, reporterHash = null }, now = Math.floor(Date.now() / 1000)) {
  const r = REPORT_REASONS.some(([k]) => k === reason) ? reason : "other";
  if (reporterHash) {
    const n = db.prepare(`SELECT COUNT(*) FROM profile_reports WHERE reporter_hash = ? AND created_at >= ?`).pluck().get(reporterHash, now - 86400);
    if (n >= REPORTS_PER_DAY) return false;
  }
  db.prepare(`INSERT INTO profile_reports (reported_user_id, handle, reason, details, reporter_user_id, reporter_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, handle, r, String(details || "").slice(0, 1000) || null, reporterUserId, reporterHash, now);
  return true;
}

export default function publicProfileRoutes(app, db, { requireAdmin, dataDir, appBaseUrl = () => "", reportPepper = "draft-profile-reports" } = {}) {
  const notFound = (res) => res.status(404).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><p>There is no page at this address.</p>`);

  app.get("/in/:handle", (req, res) => {
    let out;
    try { out = publicViewFor(db, req.params.handle, { viewerId: req.user?.id ?? null }); } catch (e) { console.warn("[d183] public page:", e.message); out = { status: 404 }; }
    res.set("Cache-Control", "no-store");
    if (out.status === 404) { res.set("X-Robots-Tag", "noindex"); return notFound(res); }
    if (!indexable(out.view)) res.set("X-Robots-Tag", "noindex");
    // (12) 45q · the employers as company objects (links + stack); a failure keeps the plain names.
    try { if (out.view?.sections?.experience?.items?.length) out.view.sections.experience.items = experienceEntities(db, out.view.sections.experience.items); } catch { /* plain names */ }
    // ⭐ D180 P1 (45o): Connect — only while the network is on, never on your own page. It opens the app, which asks first.
    res.type("html").send(renderPublicProfile(out, { origin: appBaseUrl(req), connect: networkEnabled(db) && out.userId !== (req.user?.id ?? null) }));
  });

  // The photo — only while the page is visible to the public and the person has one.
  app.get("/in/:handle/photo", (req, res) => {
    let out; try { out = publicViewFor(db, req.params.handle); } catch { out = { status: 404 }; }
    if (out.status !== 200 || out.view.private || !out.view.header?.avatar || !dataDir) return res.status(404).end();
    const rel = db.prepare("SELECT avatar_path FROM users WHERE id = ?").pluck().get(out.userId);
    const abs = rel ? path.resolve(dataDir, rel) : null;
    if (!abs || !abs.startsWith(path.resolve(dataDir) + path.sep) || !fs.existsSync(abs)) return res.status(404).end();
    const buf = fs.readFileSync(abs);
    const kind = sniffImage(buf);
    res.set({ "Content-Type": kind.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'", "X-Robots-Tag": "noindex" });
    res.send(buf);
  });

  app.post("/in/:handle/report", express.urlencoded({ extended: false, limit: "8kb" }), (req, res) => {
    const row = userForHandle(db, req.params.handle);
    if (!row) return notFound(res);
    const ip = String(req.ip || req.socket?.remoteAddress || "");
    const reporterHash = crypto.createHash("sha256").update(`${reportPepper}|${ip}`).digest("hex").slice(0, 32);
    let stored = false;
    try { stored = fileReport(db, { userId: row.user_id, handle: row.handle, reason: req.body?.reason, details: req.body?.details,
      reporterUserId: req.user?.id ?? null, reporterHash }); } catch (e) { console.warn("[d183] report:", e.message); }
    res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex");
    res.status(stored ? 200 : 429).type("html").send(shell({ title: "Report", index: false,
      body: `<section class="card"><h1>${stored ? "Thank you — the report was sent." : "You've sent several reports today."}</h1>
        <p class="muted">${stored ? "draft's moderators will look at it." : "Please try again tomorrow."}</p><p><a href="/in/${esc(row.handle)}">Back to the profile</a></p></section>` }));
  });

  // The moderation queue — admin only.
  if (requireAdmin) {
    app.get("/api/admin/profile-reports", requireAdmin, (req, res) => {
      const status = ["open", "dismissed", "actioned"].includes(req.query.status) ? req.query.status : "open";
      res.json({ reports: db.prepare(`SELECT r.id, r.handle, r.reason, r.details, r.status, r.created_at, r.resolved_at, r.resolved_note,
          r.reported_user_id, (SELECT COUNT(*) FROM profile_reports x WHERE x.reported_user_id = r.reported_user_id) AS total
        FROM profile_reports r WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`).all(status) });
    });
    app.post("/api/admin/profile-reports/:id", requireAdmin, (req, res) => {
      const status = req.body?.status;
      if (!["dismissed", "actioned", "open"].includes(status)) return res.status(400).json({ error: "bad_status", message: "dismissed, actioned or open" });
      const n = db.prepare(`UPDATE profile_reports SET status = ?, resolved_at = CASE WHEN ? = 'open' THEN NULL ELSE unixepoch() END, resolved_note = ? WHERE id = ?`)
        .run(status, status, String(req.body?.note || "").slice(0, 500) || null, Number(req.params.id)).changes;
      if (!n) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    });
  }
}
