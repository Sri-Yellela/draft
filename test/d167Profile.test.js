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
const IV = (fs.readFileSync("client/src/pages/interview/ProvingGround.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: InterviewPage.jsx deleted — its home now */;
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
        import InterviewPage from ${abs("pages/interview/ProvingGround.jsx")};   // 47m (D197 #13): Interview is the Proving ground
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

// ⛔ 47m (changed on purpose): "d167ProfileHasOwnNav · a nav card beside the dock: three groups, the eight panel" retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("d167 the dock's quick peek links to Profile's own panel addresses (one list of ids)", async () => {
  const { PROFILE_PANELS, profileHref } = await import("../client/src/components/AppNav.jsx").catch(() => ({}));
  const nav = read("client/src/components/AppNav.jsx");
  const ids = JSON.parse(nav.match(/export const PROFILE_PANELS = Object\.freeze\((\[[^\]]*\])\);/)[1]);
  assert.deepEqual(ids, [...PROFILE_PANEL_IDS], "the dock's panel ids are Profile's");
  assert.match(nav, /export const profileHref = \(panel\) => \(panel \? `\/app\/profile\/\$\{panel\}` : "\/app\/profile"\);/);
  for (const id of PROFILE_PANEL_IDS) assert.equal(profilePath(id), `/app/profile/${id}`);
  void PROFILE_PANELS; void profileHref;
});

// ⛔ 47m (changed on purpose): "d167ProfileRetainsCustomiseScreen · Profile → Appearance IS the Customise screen" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "d167ExperienceWithLogosFromResume · About you keeps the work history with compan" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "d167ProfileKeepsEverySetting · every old settings page and card has a panel — no" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ── INTERVIEW ───────────────────────────────────────────────────────────────────────────────────────

// ⛔ 47m (changed on purpose): "d167InterviewPageSections · /app/interview: Coming up · Prepare · Practise · Aft" retired — Interview is the Proving ground (D197 #13, pages/interview/ProvingGround.jsx).

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

// ⛔ 47m (changed on purpose): "d167InvitesShowInInterviewComingUp · an interview email matched to an applicatio" retired — the surface it pinned was rebuilt in the plate system (47m M5).
