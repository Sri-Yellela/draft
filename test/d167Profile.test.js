// ⭐ D167 (owner 11-06) · PROFILE WITH ITS OWN NAVIGATION (approved) and THE INTERVIEW PAGE (taken as approved) —
// docs/sketches/Profile.html, docs/sketches/Interview.html. The pages are RENDERED (esbuild + react-dom/server, as
// d105AtlasPages does) and the Coming up read runs against the real migrations and the real Inbox ingest. Synthetic people
// and companies only (Avery Sample, Northwind, Contoso).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { ingestForUser } from "../services/inbox.js";
import { upcomingInterviews } from "../services/interviewPrep.js";
import { readProfile } from "../services/structuredProfile.js";
import interviewRoutes from "../routes/interview.js";
import { at } from "../test-support/sourceAnchors.js";
import { PROFILE_GROUPS, PROFILE_PANEL_IDS, LEGACY_PROFILE_ROUTES, profilePanelFor, profilePath } from "../client/src/pages/profile/profilePanels.js";
import { INTERVIEW_GROUPS, INTERVIEW_PANEL_IDS, interviewPanelFor, whenWords, upcomingHeadline, bankCounts } from "../client/src/pages/interview/interviewModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const APP = read("client/src/App.jsx");
const PAGE = read("client/src/pages/profile/ProfilePage.jsx");
const IV = read("client/src/pages/interview/InterviewPage.jsx");
const T = (iso) => Math.floor(Date.parse(iso) / 1000);

// ── the pages, rendered ─────────────────────────────────────────────────────────────────────────────
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import { MemoryRouter } from "react-router-dom";
        import { ThemeProvider } from ${abs("styles/theme.jsx")};
        import ProfilePage, { ACCOUNT_CARDS } from ${abs("pages/profile/ProfilePage.jsx")};
        export { ACCOUNT_CARDS };
        import InterviewPage from ${abs("pages/interview/InterviewPage.jsx")};
        import CustomisePanel from ${abs("panels/CustomisePanel.jsx")};
        const wrap = (el) => renderToStaticMarkup(h(MemoryRouter, null, h(ThemeProvider, null, el)));
        export const profile = (panel) => wrap(h(ProfilePage, { panel }));
        export const interview = (panel) => wrap(h(InterviewPage, { panel }));
        export const customise = () => wrap(h(CustomisePanel));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty", ".jpg": "empty", ".webp": "empty", ".woff2": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d167-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}
const navItems = (html) => [...html.matchAll(/<a [^>]*data-place-item="([^"]+)"[^>]*>/g)].map(m => ({ id: m[1], tag: m[0] }));

// ── PROFILE ─────────────────────────────────────────────────────────────────────────────────────────

test("d167ProfileHasOwnNav · a nav card beside the dock: three groups, the eight panels at /app/profile/<id>, the current one marked", async () => {
  // A140 (45l, on purpose): About you and Your résumés are one panel; /app/profile/resumes lands on About you.
  assert.equal(profilePanelFor("profile/resumes"), "about");
  assert.deepEqual(PROFILE_PANEL_IDS, ["about", "answers", "autoapply", "connections", "appearance", "notifications", "privacy", "account"]);
  assert.deepEqual(PROFILE_GROUPS.map(g => g.label), ["You", "Applying", "You and draft"]);
  // D183 P1 (45l; pin brought to the code in 45o): the first panel is "Your profile" (the spec's nav).
  assert.deepEqual(PROFILE_GROUPS.flatMap(g => g.items.map(i => i.label)), ["Your profile", "Saved answers", "Auto-apply", "Connections",
    "Appearance", "Notifications", "Privacy and your data", "Account"], "the sketch's names");
  const { profile } = await loadUi();
  for (const id of PROFILE_PANEL_IDS) {
    const html = profile(id);
    assert.match(html, /<aside class="pl__nav" aria-label="Profile" data-place-nav="">/, `${id}: the nav card`);
    assert.match(html, /<h1 class="pl__title">Profile<\/h1>/);
    const items = navItems(html);
    assert.deepEqual(items.map(i => i.id), PROFILE_PANEL_IDS, `${id}: every panel in the nav`);
    for (const it of items) assert.match(it.tag, new RegExp(`href="/app/profile/${it.id}"`), `${it.id} is a link to its own address`);
    assert.deepEqual(items.filter(i => /aria-current="page"/.test(i.tag)).map(i => i.id), [id], `${id}: exactly the current panel is marked`);
    assert.match(html, new RegExp(`data-place-panel="${id}"`));
  }
  // the addresses: /app/profile/<id>, /app/profile#<id>, an unknown id → About you; /profile/<id> forwards under /app
  assert.equal(profilePanelFor("profile/answers"), "answers");
  assert.equal(profilePanelFor("profile", "#privacy"), "privacy");
  assert.equal(profilePanelFor("profile"), "about");
  assert.equal(profilePanelFor("profile/nope"), null);
  assert.equal(profilePanelFor("profiles"), undefined);
  assert.equal(profilePath("connections"), "/app/profile/connections");
  assert.match(APP, /const profilePanel = profilePanelFor\(routeKey, location\.hash\);/);
  assert.match(APP, /if \(profilePanel === null\) \{ navigate\(profilePath\(\), \{ replace:true \}\); return; \}/);
  assert.match(APP, /<Route path="\/profile\/\*" element=\{<ToApp\/>\}\/>/);
  assert.match(APP, /<Navigate to=\{`\/app\$\{pathname\}\$\{search\}\$\{hash\}`\} replace\/>/);
  // the same nav component as every place with its own navigation (A93: built once)
  assert.match(PAGE, /<PlaceNav place="profile" name="Profile" eyebrow="You and your résumé" title="Profile" groups=\{groups\} current=\{panel\}\n\s+hrefFor=\{profilePath\}>/);
});

test("d167 the dock's quick peek links to Profile's own panel addresses (one list of ids)", async () => {
  const { PROFILE_PANELS, profileHref } = await import("../client/src/components/AppNav.jsx").catch(() => ({}));
  const nav = read("client/src/components/AppNav.jsx");
  const ids = JSON.parse(nav.match(/export const PROFILE_PANELS = Object\.freeze\((\[[^\]]*\])\);/)[1]);
  assert.deepEqual(ids, [...PROFILE_PANEL_IDS], "the dock's panel ids are Profile's");
  assert.match(nav, /export const profileHref = \(panel\) => \(panel \? `\/app\/profile\/\$\{panel\}` : "\/app\/profile"\);/);
  for (const id of PROFILE_PANEL_IDS) assert.equal(profilePath(id), `/app/profile/${id}`);
  void PROFILE_PANELS; void profileHref;
});

test("d167ProfileRetainsCustomiseScreen · Profile → Appearance IS the Customise screen, exactly as it renders on its own", async () => {
  const { profile, customise } = await loadUi();
  const html = profile("appearance");
  // React's useId values depend on where in the tree a component renders — not the screen's markup
  const ids = (x) => x.replace(/:R[0-9a-zA-Z]+:/g, ":R:");
  const panel = ids(html.slice(at(html, 'data-place-panel="appearance"')));
  // the screen's own markup, from its root (the render's ThemeProvider <style> prefix is not the screen)
  const full = customise();
  const alone = ids(full.slice(at(full, '<div class="cz" data-customise-page=""')));
  assert.ok(panel.includes(alone), "the Customise screen's own markup, whole and unchanged, inside the panel");
  assert.doesNotMatch(panel, /data-place-head/, "no head of Profile's above it — the screen's own title stands");
  assert.match(PAGE, /else if \(panel === "appearance"\) body = <CustomisePanel \/>;/, "mounted alone, no props, no wrapper");
  // the old address lands on it
  assert.equal(LEGACY_PROFILE_ROUTES.customise, "appearance");
});

test("d167ExperienceWithLogosFromResume · About you keeps the work history with company logos filled from the résumé, as Your experience", async () => {
  // the server: the experience is read from the base résumé on first open, each company with its stored logo (or the initial)
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'avery','x')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Avery','Sample','avery.sample@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt',?,unixepoch())")
    .run("Avery Sample\nEXPERIENCE\nNorthwind — Software Engineer\nJan 2022 – Present\n- Built a queue\nContoso — Intern\nMay 2021 – Aug 2021\n- Wrote tests\n");
  db.prepare("INSERT INTO company_logos (company_key, company, status, mime, bytes, checked_at) VALUES ('northwind','Northwind','ok','image/png',x'89504E47',unixepoch())").run();
  const exp = readProfile(db, 1).sections.experience;
  assert.match(exp.find(e => e.company === "Northwind").logo, /^\/api\/company-logo\/northwind$/, "the logo, from the résumé's company");
  assert.deepEqual([exp.find(e => e.company === "Contoso").logo, exp.find(e => e.company === "Contoso").initial], [null, "C"]);
  // the client: About you mounts the Profile's "about" part, which holds the D101 sections; the box is "Your experience"
  // with its logo tiles, its design unchanged
  assert.match(PAGE, /<ProfilePanel section=\{\["about", "resumes"\]\} resumeView=\{false\} onOpenJobProfiles=/);   // A140: one panel (D183 P1: resumeView off — the page draws it)
  const PANEL = read("client/src/panels/ProfilePanel.jsx");
  const about = PANEL.slice(at(PANEL, '{on("about") && <>'), at(PANEL, '{on("answers") && <>'));
  assert.match(about, /<ProfileSections theme=\{theme\} highlight=\{/, "the sections are in About you (A140: the extracted skills / keywords bold in them)");
  const SECTIONS = read("client/src/components/ProfileSections.jsx");
  // D183 P1 (45l; pin brought to the code in 45o): the box takes the page's own title and its visibility eye.
  assert.match(SECTIONS, /<Box title=\{titles\.experience \|\| "Your experience"\} right=\{eye\("experience"\)\} theme=\{theme\}>\r?\n\s+<ListEditor theme=\{theme\} items=\{s\.experience\}/);
  assert.match(SECTIONS, /<LogoTile logo=\{x\.logo\} initial=\{x\.initial\} theme=\{theme\} \/>/);
  // and the line pointing to the skills' new home (D169)
  // ⭐ D183 P1 (45l; pin brought to the code in 45o): the old "Your skills now live in Atlas" line is the Skills section's
  // own link now — each résumé skill offers "Prove it", and the section links the skills map.
  const YP = read("client/src/pages/profile/YourProfile.jsx");
  assert.match(YP, /<Link className="yp__quiet" to="\/app\/atlas\/your-skills">Your skills map in Atlas<\/Link>/);
  assert.match(YP, /to=\{`\/app\/atlas\/your-skills\?prove=\$\{encodeURIComponent\(s\.name\)\}`\}>Prove it · 5 min<\/Link>/);
});

test("d167ProfileKeepsEverySetting · every old settings page and card has a panel — nothing dropped", async () => {
  // old route → panel; the query kept on the way (OAuth / Gmail returns)
  assert.deepEqual(LEGACY_PROFILE_ROUTES, { profile: "about", customise: "appearance", "saved-answers": "answers", integrations: "connections", account: "account" });
  assert.match(APP, /navigate\(\{ pathname: profilePath\(LEGACY_PROFILE_ROUTES\[routeKey\]\), search: location\.search \|\| "" \}, \{ replace:true \}\);/);
  assert.match(APP, /\{activeTab === "job-profiles" && <JobProfilesPanel\/>\}/, "the full job-profile manager keeps its page, opened from Your résumés");
  // Account's cards: every one is drawn by some panel
  const ACCOUNT = read("client/src/panels/AccountPanel.jsx");
  const cards = [...ACCOUNT.matchAll(/\{has\("([a-z]+)"\) &&/g)].map(m => m[1]);
  assert.deepEqual(cards.sort(), ["allowance", "data", "delete", "email", "help", "merge", "news", "notifications", "profile", "security", "sessions", "tailoring", "warmpaths"]);
  const { ACCOUNT_CARDS } = await loadUi();
  const drawn = new Set(Object.values(ACCOUNT_CARDS).flat());
  for (const c of cards) assert.ok(drawn.has(c), `Account's "${c}" card has a panel`);
  for (const k of Object.keys(ACCOUNT_CARDS)) assert.ok(PROFILE_PANEL_IDS.includes(k), `${k} is a panel`);
  // the Profile page's parts: every section of the old page is in one of three panels
  const PANEL = read("client/src/panels/ProfilePanel.jsx");
  const part = (a, b) => PANEL.slice(at(PANEL, `{on("${a}") && <>`), b ? at(PANEL, `{on("${b}") && <>`) : at(PANEL, "data-profile-savebar"));
  // D182 (45n, decision (8); pin brought to the code in 45o): the "Visa status" heading restated its one field — removed;
  // the field itself stays in About you.
  for (const t of ["Personal", "Address (for autofill)", "Application Extras"]) assert.ok(part("about", "answers").includes(`<PSec title="${t}"`), `${t} → About you`);
  assert.ok(part("about", "answers").includes('<PRow label="Visa / Immigration Status"'), "the visa field → About you");
  assert.ok(part("answers", "resumes").includes('<PSec title="Custom Answers"'), "Custom Answers → Saved answers");
  for (const t of ["Job Profiles", "Profile Resume and Signals"]) assert.ok(part("resumes").includes(`<PSec title="${t}"`), `${t} → Your résumés`);
  assert.match(PANEL, /\{\(on\("about"\) \|\| on\("answers"\)\) && \(\n\s+<div data-profile-savebar=""/, "the one Save, wherever the form is");
  // rendered: each panel carries what it holds
  const { profile } = await loadUi();
  assert.match(profile("answers"), /data-saved-answers-panel=""/, "the saved-answer bank (its existing API)");
  assert.match(profile("answers"), /Custom Answers/);
  // A140: the résumés part is in About you — ⭐ D183 P1 (45l; pin brought to the code in 45o): behind the page's
  // "Behind your profile" fold, which mounts it once the page has loaded (so a first render does not hold it).
  assert.match(read("client/src/pages/profile/YourProfile.jsx"), /\{behind\}\s*<\/details>/);
  assert.match(profile("autoapply"), /data-profile-autoapply=""/, "the tracker's settings drawer, drawn in the page");
  assert.match(PAGE, /<AutoSettingsDrawer key=\{round\} open inline=\{host\}/);
  const conn = profile("connections");
  for (const c of ["extension", "android", "gmail"]) assert.match(conn, new RegExp(`data-connection="${c}"`), `Connections: ${c}`);
  assert.match(conn, /Managed portals/);
  assert.match(PAGE, /<PortalAccounts \/>\n\s+<\/div>\n\s+<IntegrationsPanel embedded \/>\n\s+<AccountPanel only=\{ACCOUNT_CARDS\.connections\} \/>/);
  // no settings page is mounted by App any more except through Profile
  for (const p of ["ProfilePanel", "SavedAnswersPanel", "IntegrationsPanel", "AccountPanel", "CustomisePanel"]) {
    assert.doesNotMatch(APP, new RegExp(`<${p}[ /]`), `${p} is drawn only inside Profile`);
  }
});

// ── INTERVIEW ───────────────────────────────────────────────────────────────────────────────────────

test("d167InterviewPageSections · /app/interview: Coming up · Prepare · Practise · After, each panel honest about what exists", async () => {
  assert.deepEqual(INTERVIEW_GROUPS.map(g => g.label), ["Coming up", "Prepare", "Practise", "After"]);
  assert.deepEqual(INTERVIEW_PANEL_IDS, ["upcoming", "guides", "tracks", "mock", "coach", "drills", "defend", "past", "debrief"]);
  assert.equal(interviewPanelFor("interview"), "upcoming");
  assert.equal(interviewPanelFor("interview/debrief"), "debrief");
  assert.equal(interviewPanelFor("interview", "#tracks"), "tracks");
  assert.equal(interviewPanelFor("interview/x"), null);
  assert.match(APP, /\{activeTab === "interview" && interviewPanel && <InterviewPage panel=\{interviewPanel\}\/>\}/);
  assert.match(APP, /<Route path="\/interview\/\*" element=\{<ToApp\/>\}\/>/);
  const { interview } = await loadUi();
  for (const id of INTERVIEW_PANEL_IDS) {
    const html = interview(id);
    assert.deepEqual(navItems(html).map(i => i.id), INTERVIEW_PANEL_IDS);
    for (const it of navItems(html)) assert.match(it.tag, new RegExp(`href="/app/interview/${it.id}"`));
    assert.match(html, new RegExp(`data-interview-page="${id}"`));
  }
  // what exists is linked; what does not says it is coming — no sample companies, no invented numbers
  assert.match(interview("drills"), /<a [^>]*data-open-check=""[^>]*href="\/app\/atlas\/check"[^>]*>Start a check/, "D142's readiness check");
  assert.match(interview("defend"), /href="\/tools\/honesty"/);
  for (const id of ["guides", "coach", "defend", "mock"]) assert.match(interview(id), new RegExp(`data-coming="${id}"`));
  assert.match(interview("past"), /data-past-empty=""/);
  for (const id of INTERVIEW_PANEL_IDS) assert.doesNotMatch(interview(id), /Stripe|Prophetic|Plaid|142<\/b>/, `${id}: none of the sketch's sample data`);
  assert.match(interview("debrief"), /data-debrief-form=""/);
  assert.doesNotMatch(IV, /share anonymously/i, "sharing is not built, so it is not offered");
  // the pure helpers
  assert.deepEqual([whenWords(0), whenWords(1), whenWords(4), whenWords(-2), whenWords(null)], ["Today", "Tomorrow", "In 4 days", "2 days ago", null]);
  assert.deepEqual(bankCounts([{ round: "coding" }, { round: "coding" }, { round: "behavioural" }]), { coding: 2, behavioural: 1 });
  assert.equal(upcomingHeadline([]), "No interviews yet");
  assert.equal(upcomingHeadline([{ daysLeft: 3 }, { daysLeft: null }]), "2 interviews to prepare for");
});

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'avery','x'), (2,'blake','x')").run();
  return db;
}
function application(db, { userId = 1, jobId, company, title }) {
  db.prepare("INSERT OR IGNORE INTO scraped_jobs (job_id, search_query, company, title, description, skills_json, _hash) VALUES (?,?,?,?,?,?,?)")
    .run(jobId, "test", company, title, "", "[]", `h-${jobId}`);
  db.prepare("INSERT INTO application_records (user_id, job_id, state, origin, submitted_at) VALUES (?,?,'recorded','drafted',unixepoch())").run(userId, jobId);
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs) VALUES (?,'auto','completed',1)").run(userId).lastInsertRowid;
  db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,posting_title,posting_company) VALUES (?,?,?,'submitted',?,?)").run(run, userId, jobId, title, company);
  return db.prepare("SELECT id FROM application_records WHERE user_id=? AND job_id=?").pluck().get(userId, jobId);
}

test("d167InvitesShowInInterviewComingUp · an interview email matched to an application shows in Coming up — from the same Inbox, nothing moved", async () => {
  const db = freshDb();
  const nw = application(db, { jobId: "gh::northwind-1", company: "Northwind", title: "Platform Engineer" });
  const co = application(db, { jobId: "gh::contoso-1", company: "Contoso", title: "Data Engineer" });
  assert.deepEqual(upcomingInterviews(db, 1), [], "no invites yet — the honest empty state");

  const got = ingestForUser(db, { userId: 1, from: "Northwind Recruiting <talent@northwind.example>", receivedAt: T("2026-10-30T15:00:00Z"),
    subject: "Interview invitation — Northwind",
    text: "Hi Avery, thanks for applying to Northwind. We would like to schedule an interview with you on Tuesday, November 3, 2026 at 2:00 PM." });
  assert.equal(got.category, "interview");
  assert.equal(got.applicationId, nw);
  // a confirmation is Inbox mail, not an interview: Home's Inbox holds it, Coming up does not
  ingestForUser(db, { userId: 1, from: "Contoso Careers <no-reply@contoso.example>", receivedAt: T("2026-10-29T15:00:00Z"),
    subject: "Thank you for applying to Contoso", text: "Hi Avery, we received your application for Data Engineer at Contoso." });
  assert.ok(db.prepare("SELECT COUNT(*) FROM inbox_messages WHERE user_id = 1").pluck().get() >= 2, "both stay in the one Inbox");

  const up = upcomingInterviews(db, 1, { nowSec: T("2026-10-30T12:00:00Z") });
  assert.equal(up.length, 1);
  assert.deepEqual({ applicationId: up[0].applicationId, company: up[0].company, title: up[0].title, kind: up[0].kind, ymd: up[0].date.ymd, daysLeft: up[0].daysLeft },
    { applicationId: nw, company: "Northwind", title: "Platform Engineer", kind: "interview", ymd: "2026-11-03", daysLeft: 4 });
  assert.equal(up[0].subject, "Interview invitation — Northwind");
  assert.ok(!up.some(x => x.applicationId === co));
  assert.deepEqual(upcomingInterviews(db, 2), [], "⛔ another user's invites are never read");

  // the route, and the page's Prepare: the application's own Prep tab
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  interviewRoutes(app, db, (_req, _res, next) => next());
  const server = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/interview/upcoming`);
    const body = await r.json();
    assert.equal(r.status, 200);
    assert.deepEqual(body.interviews.map(i => i.applicationId), [nw]);
  } finally { server.close(); }
  assert.match(IV, /to=\{`\/app\/job\/\$\{it\.applicationId\}\?tab=prep`\} data-prepare=\{it\.applicationId\}>Prepare<\/Link>/);
  assert.match(read("client/src/panels/JobWorkspacePanel.jsx"), /if \(want === "prep" && d\?\.prep\?\.active\) setTab\("prep"\);/);
  // with no data the panel says so (rendered before the read answers: loading, never sample rows)
  const { interview } = await loadUi();
  assert.match(interview("upcoming"), /Loading…/);
  assert.match(IV, /data-upcoming-empty=""/);
});
