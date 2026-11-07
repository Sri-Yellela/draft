#!/usr/bin/env node
// scripts/d145ClutterAudit.mjs — ⭐ D145 STEP 1 · THE CLUTTER AUDIT, read-only, in a real Chrome against a LOCAL draft.
//
// Boot draft on a COPY of a migrated database with the synthetic reviewer account seeded (services/reviewerDemo.js), e.g.
//   RM_DATA_DIR=<copy dir> PORT=3961 node server.js
//   DRAFT_REVIEWER_PASSWORD=… node scripts/reviewerDemo.mjs --db <copy dir>/resume_master.db seed
// then: DRAFT_REVIEWER_PASSWORD=… node scripts/d145ClutterAudit.mjs [--base http://localhost:3961] [--out docs/clutter-shots]
//
// For every screen, at 1280 × 800 and 390 × 844, NOTHING EXPANDED beyond what the screen's own row says it opens:
// visible words (above the fold, and the whole page), actions (buttons / links / fields), the distinct features the
// screen shows, every internal or technical term a person can read, and a screenshot of the first screenful.
// Writes <out>/<screen>-<width>.png and <out>/audit.json. Never production (the base must be localhost).
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3961");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const OUT = arg("--out", "docs/clutter-shots");
const ONLY = arg("--only", null)?.split(",");
const USER = arg("--user", "draft-reviewer");
const PASS = process.env.DRAFT_REVIEWER_PASSWORD;
if (!PASS) { console.error("DRAFT_REVIEWER_PASSWORD is required"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// ── what is counted ─────────────────────────────────────────────────────────────────────────────
// A FEATURE is a distinct thing the product does that a screen shows; each detector reads the visible text.
const FEATURES = {
  "match / fit": /\b(match(es|ed)?|fit|must-haves?|best bet|good bet|long shot)\b/i,
  "eligibility / sponsorship": /\b(sponsor\w*|eligib\w*|citizen\w*|clearance|visa)\b/i,
  "freshness / ghost": /\b(posted|\d+ (hours?|days?|minutes?) ago|ghost|likely not hiring|still hiring|fresh\w*)\b/i,
  "pay": /\$\s?\d|\bsalary\b|\bpay\b/i,
  "ATS score": /\bATS\b|\bscore\b/i,
  "tailoring / drafts": /\b(tailor\w*|drafts?|drafted|cover letter|résumé|resume)\b/i,
  "auto-apply": /\b(full auto|auto[- ]?apply|apply for me|autopilot|send(s|ing)? (it|them) for you)\b/i,
  "tracking / status": /\b(applied|interview\w*|repl(y|ied|ies)|rejected|waiting|sent|submitted)\b/i,
  "inbox / email": /\b(inbox|email\w*|gmail)\b/i,
  "referrals / warm paths": /\b(referr\w*|warm path\w*|alum\w*|connections?)\b/i,
  "Atlas / map": /\b(atlas|your map|map)\b/i,
  "Learn / readiness": /\b(learn\w*|readiness|practice|defend|close the gap)\b/i,
  "filters / sort": /\b(filters?|sort(ed)?( by)?|remote|hybrid|on-?site)\b/i,
  "extension": /\b(extension|chrome)\b/i,
  "plans / credits": /\b(plans?|upgrade|pricing|credits?|PRO)\b/,
  "profiles / saved answers": /\b(job profiles?|saved answers?|profile)\b/i,
};
// INTERNAL / TECHNICAL TERMS a person can read — words of the build, not of the user. Case-sensitive where the word is
// also plain English in another sense (ring, branch, leaf, tier, run, queue are counted only as standalone words).
const TERMS = [
  ["ATS", /\bATS\b/g], ["picks", /\bpicks?\b/gi], ["ring", /\brings?\b/gi], ["liveness", /\bliveness\b/gi],
  ["tier", /\btiers?\b/gi], ["branch", /\bbranch(es)?\b/gi], ["leaf", /\b(leaf|leaves)\b/gi], ["D-number", /\b[DAO]\d{2,3}\b/g],
  ["KB / MB", /\b\d+(\.\d+)?\s?(KB|MB)\b/g], ["payload", /\bpayload\b/gi], ["lean", /\blean\b/gi], ["BYOM", /\bBYOM\b/g],
  ["token(s)", /\btokens?\b/gi], ["node", /\bnodes?\b/gi], ["slug", /\bslugs?\b/gi], ["pipeline", /\bpipelines?\b/gi],
  ["queue(d)", /\bqueued?\b/gi], ["held", /\bheld\b/gi], ["gate", /\bgates?\b/gi], ["run", /\bruns?\b/gi],
  ["enrichment", /\benrich\w*\b/gi], ["crawl / scrape", /\b(crawl\w*|scrap(e|ed|ing|er))\b/gi], ["ingest", /\bingest\w*\b/gi],
  ["provider", /\bproviders?\b/gi], ["API", /\bAPIs?\b/g], ["JSON", /\bJSON\b/g], ["signals", /\bsignals?\b/gi],
  ["synonyms", /\bsynonyms?\b/gi], ["family", /\bfamil(y|ies)\b/gi], ["claim(ed)", /\bclaim(s|ed)?\b/gi],
  ["keyword(s)", /\bkeywords?\b/gi], ["seniority", /\bseniority\b/gi], ["normalis/ze", /\bnormali[sz]\w*\b/gi],
  ["canonical", /\bcanonical\b/gi], ["taxonomy", /\btaxonom\w*\b/gi], ["model", /\b(model|Haiku|Sonnet|Opus|LLM)\b/g],
  ["mode (SIMPLE / TAILORED …)", /\b(SIMPLE|TAILORED|BASIC|A\+)\b/g], ["cache", /\bcach(e|ed|ing)\b/gi],
  ["sync", /\bsync\w*\b/gi], ["deck (as a word)", /\bdeck\b/g], ["sheet", /\bsheets?\b/gi], ["bin", /\bbin\b/gi],
  ["hash / id", /\b(hash|ID|id)\b/g],
];

// ── the screens ─────────────────────────────────────────────────────────────────────────────────
// `open` runs in the page after load: a press that opens the screen's one named sub-view (a branch, a row, a panel).
const pressText = (sel, re) => `(() => { const re = new RegExp(${JSON.stringify(re)}, "i");
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.getClientRects().length && re.test((e.innerText || e.getAttribute("aria-label") || "").trim()));
  if (el) { el.click(); return (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 60); } return null; })()`;
const SCREENS = [
  { id: "deck", name: "Daily Deck", path: "/app" },
  { id: "deck-card", name: "Daily Deck — a card opened", path: "/app", open: `(() => { const el = document.querySelector("[data-face=up] [data-deck-signal]"); if (!el) return null; el.click(); return "the top card’s report"; })()` },
  { id: "board", name: "Full House (the board)", path: "/app/jobs" },
  { id: "board-posting", name: "Full House — a posting opened", path: "/app/jobs", open: `(() => { const el = [...document.querySelectorAll("main a:not([data-apply-link]):not([data-discover])")].find(e => e.getClientRects().length && /engineer|developer|manager|scientist|analyst/i.test(e.innerText)); if (!el) return null; el.click(); return el.innerText.trim().slice(0, 60); })()` },
  { id: "draft-house", name: "Draft House", path: "/app/auto-apply" },
  { id: "draft-house-branch", name: "Draft House — an application opened", path: "/app/auto-apply", open: `(() => { const el = [...document.querySelectorAll("main button, main [role=button]")].find(e => e.getClientRects().length && /^[A-Z]$/.test((e.innerText || "").trim()) && !/account/i.test(e.getAttribute("aria-label") || "")); if (!el) return null; el.click(); return (el.getAttribute("aria-label") || el.innerText).trim().slice(0, 60); })()` },
  { id: "table", name: "The Table", path: "/app/database" },
  { id: "table-row", name: "The Table — a row opened", path: "/app/database", open: `(() => { const el = document.querySelector(".ah__row .ah__main"); if (!el) return null; el.click(); return el.innerText.split(String.fromCharCode(10)).join(" ").slice(0, 60); })()` },
  { id: "inbox", name: "The Table — Inbox", path: "/app/database", open: pressText("button, [role=tab], a", "^inbox") },
  { id: "atlas", name: "Atlas home", path: "/app/atlas" },
  { id: "your-map", name: "Atlas — Your map, a waypoint opened (side panel)", path: "/app/atlas", open: `(() => { const el = document.querySelector("[data-waypoint=yours]"); if (!el) return null; el.click(); return "Your skills"; })()` },
  { id: "learn", name: "Learn (the circle)", path: "/app/atlas/learn" },
  { id: "learn-piece", name: "Learn — a piece opened", path: "/app/atlas/learn", open: `(() => { const el = [...document.querySelectorAll("[data-learn-piece], [data-piece], svg [role=button], svg a, button")].find(e => e.getClientRects().length && /piece|step|\\d/.test(e.getAttribute("data-learn-piece") || e.getAttribute("aria-label") || e.textContent || "")); if (!el) return null; el.dispatchEvent(new MouseEvent("click", { bubbles: true })); return (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 50); })()` },
  { id: "readiness", name: "Atlas — readiness check", path: "/app/atlas/check" },
  { id: "profile", name: "Profile", path: "/app/profile" },
  { id: "auto-settings", name: "Auto settings (Draft House)", path: "/app/auto-apply", open: pressText("button, a, [role=tab]", "(settings|full auto|how it applies|auto)") },
  { id: "account", name: "Account", path: "/app/account" },
  { id: "job-page", name: "The job page (public)", path: "JOBPAGE" },
  { id: "landing", name: "Landing (signed out)", path: "/", signedOut: true },
];

async function measure(page) {
  return page.evaluate((FEATURES_SRC, TERMS_SRC) => {
    const vw = innerWidth, vh = innerHeight;
    const shown = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false; } return true; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let fold = [], all = [], ownFold = [], own = [], bodyFold = [], body = [];
    // The site's own top bar / navigation is the same on every screen: counted in the words, NOT read for features
    // or terms (its "Atlas" and "Draft House" tabs would otherwise mark every screen as showing the map and drafts).
    const CHROME = "[data-app-chrome], nav[aria-label=Main], body > div > header, header nav";
    // NOT draft's words: an employer's posting text and job titles, a résumé's text, what a person typed.
    const FOREIGN = "[data-posting-body], [data-vt-title], [data-job-title], [data-resume-text], [data-resume-preview], textarea, pre, [contenteditable=true], input, select, option, .ah__title, .ah__company";
    const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’.+\-/]*/gu;
    for (let n; (n = walker.nextNode());) {
      const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (!t) continue;
      const p = n.parentElement; if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.tagName) || !shown(p)) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter(q => q.width > 1 && q.height > 1);
      if (!rects.length) continue;
      // clipped away by an overflow:hidden ancestor of 1px (screen-reader-only text) is not visible
      if (p.closest("[class*='sr-only'], .visually-hidden")) continue;
      const inFoldT = rects.some(q => q.bottom > 0 && q.top < vh && q.right > 0 && q.left < vw);
      all.push(t); if (inFoldT) fold.push(t);
      if (!p.closest(FOREIGN)) { own.push(t); if (inFoldT) ownFold.push(t);
        if (!p.closest(CHROME)) { body.push(t); if (inFoldT) bodyFold.push(t); } }
    }
    const words = (a) => a.reduce((s, t) => s + (t.match(WORD) || []).length, 0);
    const actEls = [...document.querySelectorAll("button, a[href], [role=button], [role=tab], [role=link], input:not([type=hidden]), select, textarea, summary")]
      .filter(e => e.getClientRects().length && shown(e) && !e.disabled && e.getBoundingClientRect().width > 2);
    const label = (e) => (e.innerText || e.getAttribute("aria-label") || e.getAttribute("title") || e.getAttribute("placeholder") || e.value || e.tagName).replace(/\s+/g, " ").trim().slice(0, 40);
    const inFold = (e) => { const q = e.getBoundingClientRect(); return q.bottom > 0 && q.top < vh && q.right > 0 && q.left < vw; };
    // features and terms read draft's own words only (FOREIGN above)
    const text = body.join(" \n ");
    const foldText = bodyFold.join(" \n ");
    const F = JSON.parse(FEATURES_SRC).map(([k, s, f]) => [k, new RegExp(s, f)]);
    const T = JSON.parse(TERMS_SRC).map(([k, s, f]) => [k, new RegExp(s, f)]);
    const terms = {};
    for (const [k, re] of T) { const m = text.match(re); if (m) terms[k] = { count: m.length, examples: [...new Set(m)].slice(0, 4) }; }
    // a short line of context for each term (the first visible text holding it)
    for (const [k, re] of T) if (terms[k]) { const hit = body.find(t => { re.lastIndex = 0; return re.test(t); }); terms[k].context = hit?.slice(0, 90); }
    return {
      wordsFold: words(fold), wordsPage: words(all), ownFold: words(ownFold), ownPage: words(own),
      actionsFold: actEls.filter(inFold).length, actionsPage: actEls.length,
      actionLabelsFold: [...new Set(actEls.filter(inFold).map(label))].slice(0, 40),
      features: F.filter(([, re]) => re.test(text)).map(([k]) => k),
      featuresFold: F.filter(([, re]) => re.test(foldText)).map(([k]) => k),
      terms,
      pageHeight: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, JSON.stringify(Object.entries(FEATURES).map(([k, re]) => [k, re.source, re.flags])),
     JSON.stringify(TERMS.map(([k, re]) => [k, re.source, re.flags])));
}

const settle = (ms) => new Promise(r => setTimeout(r, ms));
async function signIn(page) {
  return page.evaluate(async (u, p) => {
    const r = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
    const j = await r.json().catch(() => ({}));
    if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
    return r.status;
  }, USER, PASS);
}

// a public job page: the first /jobs/ URL in the sitemap
let JOBPAGE = "/jobs";
try { const xml = await (await fetch(`${BASE}/sitemap-jobs.xml`)).text(); const m = /<loc>[^<]*?(\/jobs\/[^<]+)<\/loc>/.exec(xml); if (m) JOBPAGE = m[1]; } catch {}

const results = [];
const b = await launchBrowser({ headless: "new" });
try {
  for (const s of SCREENS) {
    if (ONLY && !ONLY.includes(s.id)) continue;
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const ctx = await b.createBrowserContext();
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message.slice(0, 120)));
      await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
      // First-visit prompts are part of what a person sees; nothing is dismissed.
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      let note = "";
      if (!s.signedOut) note = `sign-in ${await signIn(page)}`;
      const target = s.path === "JOBPAGE" ? JOBPAGE : s.path;
      await page.goto(`${BASE}${target}`, { waitUntil: "networkidle2", timeout: 60000 }).catch(e => errors.push("goto " + e.message.slice(0, 80)));
      await settle(1500);
      let opened = null;
      if (s.open) { opened = await page.evaluate(s.open).catch(e => "ERR " + e.message.slice(0, 60)); await settle(1800); }
      const m = await measure(page);
      const file = `${s.id}-${w}.png`; // committed as .jpg (ffmpeg -q:v 4) to keep the repository small
      await page.screenshot({ path: path.join(OUT, file) });
      results.push({ id: s.id, name: s.name, path: target, width: w, opened, note, url: page.url().replace(BASE, ""), errors, shot: file, ...m });
      console.log(`${s.id.padEnd(20)} ${String(w).padStart(4)}  own ${String(m.ownFold).padStart(4)} / ${String(m.ownPage).padStart(5)}  words ${String(m.wordsFold).padStart(4)} / ${String(m.wordsPage).padStart(5)}  actions ${String(m.actionsFold).padStart(3)} / ${String(m.actionsPage).padStart(3)}  features ${m.features.length}  terms ${Object.keys(m.terms).length}  ${opened === null && s.open ? "⚠ NOT OPENED" : opened ? `opened: ${opened}` : ""} ${page.url().replace(BASE, "")} ${errors.length ? "ERR " + errors[0] : ""}`);
      await ctx.close();
    }
  }
} finally { await b.close(); }
const prev = fs.existsSync(path.join(OUT, "audit.json")) && ONLY ? JSON.parse(fs.readFileSync(path.join(OUT, "audit.json"), "utf8")) : [];
const merged = [...prev.filter(r => !results.some(x => x.id === r.id && x.width === r.width)), ...results];
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(merged, null, 1));
console.log(`wrote ${results.length} rows → ${OUT}/audit.json`);
