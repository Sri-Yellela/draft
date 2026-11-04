// ⛔ D59 (owner, 10-07) · POSTINGS THAT ARRIVE AS RAW HTML AND LABEL BLOCKS.
//
// An imported RTX posting was stored as raw HTML with `\"`-escaped quotes and a leading block of
// `Label: value` lines; the panel escaped it, so the tags showed as text. The fix converts markup to TEXT
// through an allow-list (never renders it — a capture lands in the SHARED pool), reads the label block
// into fields, parses coded locations, tags citizenship / clearance, and stores all of it in NEW columns
// (migration 137) — `description` and `content_hash` are never rewritten (A76's grades key on them).
//
// The ⛔ list, each red when the thing it pins is removed:
//   the RTX text renders with no visible tags and no `\"` · the label block becomes fields and does not
//   also appear in the body · `Boston Post Rd` is not the city · citizen_only and us_person stay distinct ·
//   the hostile fixture is inert · description and content_hash are unchanged after the backfill · a
//   capture with `Country: United States of America` is accepted.
// Fixtures are SYNTHETIC reconstructions (test/fixtures/d59Postings.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { RTX_HTML, NORTHROP_TEXT, LOCKHEED_TEXT, BLUE_ORIGIN_TEXT, HOSTILE_HTML } from "./fixtures/d59Postings.js";
import { normalizePosting, postingPlainText, parseCodedLocation, textForRender } from "../shared/postingNormalize.js";
import { postingRequirements, requirementPills, eligibilityNotice, statedEligibility, requiresEligibility } from "../shared/postingRequirements.js";
import { deckStrip } from "../shared/postingFacts.js";
import { formatPosting } from "../shared/postingFormat.js";
import { parsePlaces, formatPlaceList, deriveTags, TAGGER_VERSION } from "../services/jobs/jobTags.js";
import { backfillDescriptionText, deriveDescriptionColumns, withPostingText, DESCRIPTION_BACKFILL_CEILING } from "../services/jobs/descriptionText.js";
import { computeContentHash } from "../services/jobs/enrichmentSelection.js";
import { mapJobRow } from "../services/jobs/mapJobRow.js";
import { atsJobInputHash } from "../services/jobs/boardFitPrecompute.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { importJob } from "../services/jobs/importJob.js";
import { captureMarket } from "../services/jobs/usLocation.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function migratedDb() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  return d;
}
function seed(d, id, description, extra = {}) {
  const title = extra.title || "Systems Engineer";
  d.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, location, url, source, description, content_hash, is_active)
             VALUES (?, 'test', ?, ?, ?, ?, ?, 'import', ?, ?, 1)`)
    .run(id, `h-${id}`, title, extra.company || "Synthetic Defense Co", extra.location ?? null, `https://example.com/${id}`,
      description, computeContentHash(title, description));
}

// ── Render the real PostingPanel (esbuild from client/node_modules + react-dom/server) ─────────────
const CLIENT = path.resolve("client");
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import PostingPanel from ${abs("components/PostingPanel.jsx")};
        export const html = (props) => renderToStaticMarkup(createElement(PostingPanel, props));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d59-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}
/** The words a reader SEES: the rendered markup with its own (React's) tags removed and entities read. */
const visibleText = (markup) => markup.replace(/<[^>]+>/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

/** The RTX posting as the board serves it after the backfill — the real row, through mapJobRow. */
function rtxJob() {
  const d = migratedDb();
  seed(d, "rtx", RTX_HTML, { location: null });
  backfillDescriptionText(d, { dryRun: false });
  const job = mapJobRow(d.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'rtx'").get());
  d.close();
  return job;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 1 · MARKUP → TEXT
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ D59 · the RTX text renders with NO visible tags and NO \\\" — through the board's real row", async () => {
  const job = rtxJob();
  // The INGEST layer: the board serves text — the render-time re-check (below) is the second layer.
  for (const bad of ["<p", "<b>", "style=", '\\"', "&nbsp;"]) assert.ok(!job.description.includes(bad), `the served description carries ${bad}`);
  const { html } = await loadUi();
  const seen = visibleText(html({ job }));
  for (const bad of ["<p", "<b>", "</", "style=", "text-align", '\\"', "&lt;", "&nbsp;"]) {
    assert.ok(!seen.includes(bad), `the reader sees ${JSON.stringify(bad)}`);
  }
  assert.match(seen, /The Sensors team is looking for a Systems Engineer/);
  // Their structure survives as React elements: a heading, the list, the paragraph.
  const markup = html({ job });
  assert.match(markup, /<h3 class="posting__h">What You Will Do<\/h3>/);
  assert.match(markup, /<li>Plan integration &amp; test events with hardware teams<\/li>/);
});

test("⛔ D59 · RE-CHECKED AT RENDER — a row not yet normalised still shows no tags", async () => {
  const { html } = await loadUi();
  const seen = visibleText(html({ job: { title: "Systems Engineer", company: "X", description: RTX_HTML } }));
  for (const bad of ["<p", "style=", "text-align", '\\"']) assert.ok(!seen.includes(bad), `the reader sees ${bad}`);
  assert.equal(textForRender("Plain text, 5 < 6."), "Plain text, 5 < 6.", "plain text is drawn as it is");
});

test("⛔ D59 · the HOSTILE fixture is INERT — no script, no handler, no javascript: link, no frame, no style", async () => {
  const text = postingPlainText(HOSTILE_HTML);
  for (const bad of [/<script/i, /onerror/i, /onclick/i, /onload/i, /onmouseover/i, /javascript:/i, /<iframe/i, /<img/i, /<svg/i, /<object/i, /position:fixed/i, /document\.cookie/i, /alert\(/i]) {
    assert.doesNotMatch(text, bad, `the normalised text keeps ${bad}`);
  }
  assert.match(text, /Great role\./);
  assert.match(text, /Apply here/, "a link's words survive; its href never does");
  assert.match(text, /Bold words/);
  const { html } = await loadUi();
  const markup = html({ job: { title: "T", company: "C", description: HOSTILE_HTML } });
  for (const bad of [/<script/i, /\son\w+=/i, /href=/i, /<iframe/i, /<img/i, /<svg/i, /<object/i, /style="position/i, /javascript:/i]) {
    assert.doesNotMatch(markup, bad, `the rendered panel carries ${bad}`);
  }
});

test("D59 · plain text is left alone — only entities, stray \\\" and a label block change", () => {
  const plain = "We build tools.\n\nRequirements:\n• 3+ years of Go\n\n  indented   spacing   kept";
  assert.equal(normalizePosting(plain).text, plain);
  assert.equal(normalizePosting(plain).changed, false);
  assert.equal(postingPlainText('AT&amp;T says \\"hi\\"'), 'AT&T says "hi"');
  assert.equal(postingPlainText("&lt;p&gt;Encoded&lt;/p&gt;&lt;ul&gt;&lt;li&gt;one&lt;/li&gt;&lt;/ul&gt;"), "Encoded\n\n• one");
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 2 · LABEL BLOCKS → FIELDS
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ D59 · the label block becomes FIELDS and does NOT also appear in the body", () => {
  const n = normalizePosting(RTX_HTML);
  assert.equal(n.fields.postedAt, "2026-08-26");
  assert.equal(n.fields.country, "United States of America");
  assert.equal(n.fields.countryIsUs, true);
  assert.equal(n.fields.workplace, "onsite");
  assert.equal(n.fields.locationLabel, "Marlborough, MA");
  assert.equal(n.fields.clearanceType, "DoD Clearance: Secret");
  for (const label of ["Date Posted", "Country", "Position Role Type", "Security Clearance", "Immigration Status", "2026-08-26", "Boston Post Rd"]) {
    assert.ok(!n.text.includes(label), `the body still says ${label}`);
  }
  assert.ok(n.text.startsWith("About the role:"), "the body starts where the employer's prose does");
  // Unknown labels STAY in the text; Northrop's travel and relocation become fields.
  const ng = normalizePosting(NORTHROP_TEXT);
  assert.match(ng.text, /^TELECOMMUTE: No\n\nDescription/, "an unknown label stays, set apart from the body");
  assert.equal(ng.fields.travel, "Yes, 10% of the Time");
  assert.equal(ng.fields.relocation, "Relocation assistance may be available");
  assert.equal(ng.fields.requisitionId, "R10000001");
  assert.doesNotMatch(ng.text, /TRAVEL|RELOCATION|Requisition|CLEARANCE/);
});

test("D59 · Date Posted is the POSTING's date in the Posted cell; Position Role Type is the Workstyle cell and tag", () => {
  const job = rtxJob();
  const now = Date.UTC(2026, 8, 5);
  const cells = Object.fromEntries(deckStrip(job, { now }).map(c => [c.key, c]));
  assert.equal(job.postedAt, "2026-08-26");
  assert.equal(cells.posted.value, "10d ago");
  assert.equal(cells.workstyle.value, "On-site");
  assert.equal(cells.workstyle.sub, "Marlborough, MA", "the label block's location, coded form read");
  assert.equal(cells.experience.value, "5+ yrs");
  const tags = deriveTags({ title: "Systems Engineer", location: null, description: job.description,
    description_fields: JSON.stringify(normalizePosting(RTX_HTML).fields) });
  assert.equal(tags.workplace, "onsite", "the workstyle TAG reads the label too (D29)");
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 3 · CODED LOCATIONS
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ D59 · `Boston Post Rd` is NOT the city — Marlborough, MA, site MA2, the street kept apart", () => {
  const raw = "US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd BLDG 2";
  assert.deepEqual(parseCodedLocation(raw),
    { country: "US", state: "MA", city: "Marlborough", site: "MA2", street: "1001 Boston Post Rd BLDG 2" });
  assert.equal(formatPlaceList(parsePlaces(raw)), "state:MA", "tagged Massachusetts — never metro:boston");
  assert.ok(TAGGER_VERSION >= 3, "the rule changed, so every stored row must re-tag");
  // The label block's location reaches the tags the same way.
  const tags = deriveTags({ title: "Engineer", location: null, description: "",
    description_fields: JSON.stringify({ location: raw, countryIsUs: true }) });
  assert.equal(formatPlaceList(tags.places), "state:MA");
  assert.deepEqual(parseCodedLocation("United States-Virginia-Chantilly"),
    { country: "US", state: "VA", city: "Chantilly", site: null, street: null });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 4 · CITIZENSHIP AND CLEARANCE — surfaced, never decided
// ════════════════════════════════════════════════════════════════════════════════════════════════

const reqOf = (raw) => postingRequirements(normalizePosting(raw));

test("⛔ D59 · citizen_only and us_person stay DISTINCT", () => {
  assert.equal(reqOf(RTX_HTML).citizenship, "citizen_only");
  assert.equal(reqOf(BLUE_ORIGIN_TEXT).citizenship, "us_person", "export-control wording is not citizens-only");
  assert.equal(reqOf(LOCKHEED_TEXT).citizenship, "none_stated");
  assert.equal(reqOf("We are an equal opportunity employer and do not discriminate on citizenship status.").citizenship, "none_stated",
    "EEO boilerplate names citizenship as protected, not required");
  assert.equal(reqOf("Applicants must be U.S. citizens or permanent residents.").citizenship, "us_person");
  assert.notEqual(requirementPills(reqOf(RTX_HTML))[0].label, requirementPills(reqOf(BLUE_ORIGIN_TEXT))[0].label);
});

test("D59 · clearance level, status and polygraph — label first, then prose; a level is never guessed", () => {
  assert.deepEqual(reqOf(RTX_HTML), { citizenship: "citizen_only", clearance: "secret", clearanceStatus: "active_required", polygraph: false,
    sponsorship: "none_stated", degree: null }); // D104 P1 added the two fields (10-30)
  assert.deepEqual(reqOf(LOCKHEED_TEXT), { citizenship: "none_stated", clearance: "ts_sci", clearanceStatus: "active_required", polygraph: true,
    sponsorship: "none_stated", degree: null }); // D104 P1 added the two fields (10-30)
  // "CLEARANCE TYPE: Polygraph" — a clearance is required, its level is NOT stated: "unspecified", not Top Secret.
  assert.deepEqual(reqOf(NORTHROP_TEXT), { citizenship: "none_stated", clearance: "unspecified", clearanceStatus: "active_required", polygraph: true,
    sponsorship: "none_stated", degree: null }); // D104 P1 added the two fields (10-30)
  assert.equal(reqOf("Must be able to obtain a Secret clearance; interim not available.").clearanceStatus, "ability_to_obtain");
  assert.equal(reqOf("Our secret sauce is the team.").clearance, "none", "a bare 'secret' is not a clearance");
  assert.equal(reqOf("No security clearance required.").clearance, "none");
  assert.deepEqual(requirementPills(reqOf(RTX_HTML)).map(p => p.label), ["U.S. citizens only", "Secret clearance", "active required"]);
});

// The local backfill (10-07) read 34 clearance tags off 2,616 real postings; these are the misreadings it
// found, in the postings' own words.
test("⛔ D59 · clearance misreadings from the local backfill — public trust as prose, the floor of several levels, the wish list", () => {
  assert.equal(reqOf("You will partner with researchers to strengthen model reliability and public trust.").clearance, "none",
    "'public trust' in ordinary English is not a clearance");
  assert.equal(reqOf("Applicants must be U.S. citizens with the ability to obtain and maintain a Tier 4 (High Risk Public Trust) background investigation.").clearance,
    "public_trust");
  const floor = reqOf("Must have: • At least an active secret clearance and the ability & willingness to up level to TS/SCI.");
  assert.equal(floor.clearance, "secret", "the requirement is the lowest level named — TS/SCI is what it may grow into");
  assert.equal(floor.clearanceStatus, "active_required");
  assert.equal(reqOf("• Possession of an active Secret or TS/SCI clearance").clearance, "secret", "either satisfies it, so Secret does");
  assert.equal(reqOf("This role will require an active TS security clearance Ideally You'd Have: • 2+ years of experience").clearance, "top_secret",
    "a run-on bullet list still carries the requirement before its wish list");
  assert.equal(reqOf("This role will require an active TS security clearance Nice to haves: • a desire to mentor").clearance, "top_secret",
    "the wish list's words do not cancel the requirement before it");
  assert.equal(reqOf("Requirements:\n• 5+ years of Python\nNice to haves:\n• A Top Secret U.S. security clearance\n• 4+ years of experience").clearance, "none",
    "a bullet beneath a 'Nice to haves:' heading is not required");
  assert.equal(reqOf("Nice to haves:\n• Go\nMust Haves:\n• An active TS/SCI clearance").clearance, "ts_sci", "the next heading ends the wish list");
  const poly = reqOf("Must Haves: • An active TS/SCI clearance (Full Scope Polygraph is a nice to have) • 3+ years");
  assert.equal(poly.clearance, "ts_sci");
  assert.equal(poly.polygraph, false, "a polygraph the posting only wishes for is not required");
  assert.equal(reqOf("You might thrive in this role if you\n - Bring 5+ years of experience, ideally in government environments.\n - Active TS/SCI clearance or equivalent").clearance,
    "ts_sci", "an ordinary 'ideally' is not a wish-list heading");
  assert.equal(reqOf("• Have an active Secret security clearance (Top Secret preferred)").clearance, "secret",
    "a preference in parentheses does not cancel the requirement beside it");
  assert.equal(reqOf("• An active TS/SCI clearance.\nBonus\n• An active polygraph").polygraph, false, "a bare 'Bonus' line opens a wish list");
  assert.deepEqual([reqOf("You might thrive in this role if you have:\n - An active US security clearance.").clearance,
    reqOf("You might thrive in this role if you have:\n - An active US security clearance.").clearanceStatus], ["unspecified", "active_required"],
    "a clearance bullet with no level is 'Clearance required', not nothing");
  assert.equal(reqOf("Preferred qualifications\n• Active federal security clearance (Secret or above)").clearance, "none");
  assert.equal(reqOf("Advance national security Nice to haves: • A Top Secret U.S. security clearance • 4+ years").clearance, "none",
    "a clearance under 'Nice to haves' is not required");
});

test("⛔ D59 · the notice at Draft — the row's own sentence; it says what the POSTING asks, never a verdict", () => {
  assert.equal(eligibilityNotice(reqOf(RTX_HTML), { citizenship: false, clearance: false }),
    "This role requires U.S. citizenship and an active Secret clearance. Your profile doesn't state either — draft will stop and ask.");
  assert.match(eligibilityNotice(reqOf(RTX_HTML), { citizenship: true, clearance: false }), /doesn't state a clearance/);
  assert.doesNotMatch(eligibilityNotice(reqOf(RTX_HTML), { citizenship: true, clearance: true }), /eligible|qualif|you (are|meet)/i);
  assert.equal(eligibilityNotice(reqOf("Build web apps."), {}), null);
  // "stated" reads only whether an answer exists — a saved citizenship answer, a stated clearance level.
  assert.deepEqual(statedEligibility({ custom_answers: JSON.stringify({ "Are you a U.S. citizen?": "Yes" }), clearance_level: "" }),
    { citizenship: true, clearance: false });
  assert.deepEqual(statedEligibility({ custom_answers: "{}", clearance_level: null }), { citizenship: false, clearance: false });
  // The panel shows it beside Draft, and Draft asks before it acts.
  assert.match(read("client/src/components/JobDetailPanel.jsx"), /data-eligibility-notice=""/);
  // Owner 10-07 (38): "only in panel" — the notice is the panel's line beside Draft, never a confirm at the click.
  const jp = read("client/src/panels/JobsPanel.jsx");
  assert.match(jp, /eligibilityNotice: isJobDrafted\(selectedJob\.jobId\) \? null : eligibilityNoticeFor\(selectedJob\)/, "the panel line");
  assert.doesNotMatch(jp, /window\.confirm\([^)]*eligibility/i, "no confirm at Draft");
  assert.doesNotMatch(jp, /Draft it anyway\?/, "no confirm at Draft");
});

test("⛔ D59 · the Requirements row: muted, NON-interactive pills under the deck strip — never in the ATS score", async () => {
  const { html } = await loadUi();
  const markup = html({ job: rtxJob() });
  const row = /<div class="posting__req" data-posting-requirements=""[^>]*>([\s\S]*?)<\/div>/.exec(markup);
  assert.ok(row, "the Requirements row renders");
  assert.match(row[1], /U\.S\. citizens only[\s\S]*Secret clearance[\s\S]*active required/);
  assert.doesNotMatch(row[1], /<button|<a\s/, "a status pill is never pressed");
  assert.ok(markup.indexOf("data-posting-strip") < markup.indexOf("data-posting-requirements"), "under the strip");
  // The scorer is handed the text — never the requirement tags.
  const scorer = read("packages/ats-scorer/src/index.js");
  assert.doesNotMatch(scorer, /req_citizenship|req_clearance|requirements\.citizenship/);
});

test("⛔ D59 · the filter hides roles that STATE clearance or citizenship — and keeps a posting not read yet", () => {
  const d = migratedDb();
  seed(d, "rtx", RTX_HTML);
  seed(d, "blue", BLUE_ORIGIN_TEXT);
  seed(d, "lm", LOCKHEED_TEXT);
  seed(d, "plain", "Build web apps in TypeScript.");
  backfillDescriptionText(d, { dryRun: false });
  seed(d, "unread", RTX_HTML.replace("Sensors", "Radar"));          // not read yet: req_* NULL
  const f = buildJobFilters({ hide_eligibility_required: "1" });
  const ids = d.prepare(`SELECT job_id FROM scraped_jobs sj WHERE 1 = 1 ${f.sql} ORDER BY job_id`).all(...f.params).map(r => r.job_id);
  assert.deepEqual(ids, ["plain", "unread"]);
  // ⛔ A re-crawl rewrites the description (here: the clearance sentence is gone). Until the next pass
  // re-reads it, the old reading is STALE — the row is "not read yet" and is kept, not hidden on the old
  // text's say-so. The same rule as the readers' (description_basis).
  d.prepare("UPDATE scraped_jobs SET description = ? WHERE job_id = 'lm'").run("Build radar software in C++.");
  const after = d.prepare(`SELECT job_id FROM scraped_jobs sj WHERE 1 = 1 ${f.sql} ORDER BY job_id`).all(...f.params).map(r => r.job_id);
  assert.deepEqual(after, ["lm", "plain", "unread"], "a stale reading never hides a row");
  assert.equal(buildJobFilters({}).sql.includes("req_citizenship"), false, "off by default");
  const panel = read("client/src/panels/JobsPanel.jsx");
  assert.match(panel, /Hide roles that require clearance or citizenship/);
  assert.match(panel, /if \(hideEligibility\)\s+p\.set\("hide_eligibility_required", "1"\);/);
  assert.ok(requiresEligibility(reqOf(NORTHROP_TEXT)));
  d.close();
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 5 · DO NOT BREAK THE GRADES
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ D59 · `description` and `content_hash` are UNCHANGED after the backfill — only the new columns are written", () => {
  const d = migratedDb();
  for (const [id, text] of [["rtx", RTX_HTML], ["ng", NORTHROP_TEXT], ["lm", LOCKHEED_TEXT], ["bo", BLUE_ORIGIN_TEXT], ["x", HOSTILE_HTML]]) seed(d, id, text);
  const before = d.prepare("SELECT job_id, title, description, content_hash FROM scraped_jobs ORDER BY job_id").all();
  const dry = backfillDescriptionText(d);
  assert.equal(dry.dryRun, true, "dry run by default");
  assert.equal(dry.written, 0);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM scraped_jobs WHERE description_basis IS NOT NULL").get().n, 0, "a dry run writes nothing");
  const run = backfillDescriptionText(d, { dryRun: false });
  assert.equal(run.written, 5);
  const after = d.prepare("SELECT job_id, title, description, content_hash FROM scraped_jobs ORDER BY job_id").all();
  assert.deepEqual(after, before, "description and content_hash are byte-identical");
  for (const r of after) assert.equal(r.content_hash, computeContentHash(r.title, r.description), "every graded hash is still current");
  const rtx = d.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'rtx'").get();
  assert.ok(rtx.description_text && !rtx.description_text.includes("<p"), "the text went to description_text");
  assert.equal(rtx.req_citizenship, "citizen_only");
  assert.equal(backfillDescriptionText(d, { dryRun: false }).written, 0, "idempotent: a settled board writes nothing");
  // ⛔ the brake: past the ceiling it refuses and writes none.
  seed(d, "n1", "a"); seed(d, "n2", "b");
  const refused = backfillDescriptionText(d, { dryRun: false, ceiling: 1 });
  assert.equal(refused.refused, true);
  assert.equal(refused.written, 0);
  assert.ok(DESCRIPTION_BACKFILL_CEILING >= 1000);
  d.close();
});

test("D59 · the scorer reads the normalised text — and never a STALE one after the description changes", () => {
  const d = migratedDb();
  seed(d, "rtx", RTX_HTML);
  backfillDescriptionText(d, { dryRun: false });
  const row = d.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'rtx'").get();
  assert.equal(withPostingText(row).description, row.description_text);
  assert.notEqual(atsJobInputHash(row), atsJobInputHash({ ...row, description_text: null }), "the hash follows the text the scorer reads");
  // A re-crawl rewrites the description: the old text, fields and requirements stop being served at once.
  d.prepare("UPDATE scraped_jobs SET description = 'Now a plain posting.' WHERE job_id = 'rtx'").run();
  const moved = d.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'rtx'").get();
  assert.equal(withPostingText(moved).description, "Now a plain posting.");
  const job = mapJobRow(moved);
  assert.equal(job.description, "Now a plain posting.");
  assert.equal(job.requirements, null, "unknown until re-read — not the old posting's citizen_only");
  assert.equal(backfillDescriptionText(d, { dryRun: false }).written, 1, "the next pass re-reads it");
  d.close();
});

test("D59 · migration 137 is byte-identical in both runners and adds only new columns", () => {
  const block = (src) => { const i = at(src, 'id: "137_description_text"'); return src.slice(i, at(src, "\n    },", i)); };
  const server = read("server.js"), runner = read("scripts/migrations.js");
  assert.ok(block(server).length > 100);
  assert.equal(block(server), block(runner));
  assert.doesNotMatch(block(server), /DROP|RENAME|UPDATE scraped_jobs SET description\b/i);
  const cols = migratedDb().prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name);
  for (const c of ["description_text", "description_fields", "description_basis", "req_citizenship", "req_clearance", "req_clearance_status", "req_polygraph"]) {
    assert.ok(cols.includes(c), c);
  }
  assert.deepEqual(Object.keys(deriveDescriptionColumns("x")).sort(),
    ["description_basis", "description_fields", "description_text", "pay_text_max_usd", "pay_text_min_usd", "req_citizenship", "req_clearance", "req_clearance_status", "req_polygraph"],
    "the pass writes only migration 137's columns and D71's two (migration 141) — never description, content_hash or salary_*");
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// D41(d) · `Country: United States of America` is POSITIVE US evidence
// ════════════════════════════════════════════════════════════════════════════════════════════════

function captureDb() {
  const d = migratedDb();
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active)
             VALUES (7,1,'Current','engineering','general',1)`).run();
  return d;
}
const labelled = (body, title = "Radar Software Engineer") => [`Title: ${title}`, "Company: Synthetic Defense Co", "Location: Remote", "", body].join("\n");

test("⛔ D59 · a capture with `Country: United States of America` is ACCEPTED — even as escaped HTML", async () => {
  const d = captureDb();
  const body = '<p style=\\"text-align:left\\"><b>Country:</b></p>United&nbsp;States&nbsp;of&nbsp;America<br>' +
    "<p>Write radar signal-processing software.</p>";
  const r = await importJob({ url: "https://careers.synthetic-defense.example.com/job/1", text: labelled(body) }, { db: d, userId: 1 });
  assert.equal(r.capture.outcome, "inserted");
  const row = d.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(r.job.id);
  assert.equal(row.is_active, 1);
  assert.equal(r.job.description, "Write radar signal-processing software.", "the answer carries the normalised text");
  assert.equal(row.description, body, "the stored description is the capture, untouched");
  // `Country: US` — no phrase the page-text test knows — is admitted by the label alone.
  const r2 = await importJob({ url: "https://careers.synthetic-defense.example.com/job/2", text: labelled("Country: US\n\nWrite flight software for the guidance computer.", "Guidance Software Engineer") }, { db: d, userId: 1 });
  assert.equal(r2.capture.outcome, "inserted");
  // …and a page with neither is still refused, so the label is what admitted these.
  await assert.rejects(importJob({ url: "https://careers.synthetic-defense.example.com/job/3", text: labelled("Write test software for the antenna range.", "Antenna Test Engineer") }, { db: d, userId: 1 }),
    (e) => e.kind === "unconfirmed");
  assert.equal(captureMarket({ location: "Remote", statedCountryUs: true }).reason, "capture_country_label");
  d.close();
});

test("D59 · one normaliser for every source: the panel's formatter, the capture and the backfill share it", () => {
  for (const f of ["services/jobs/descriptionText.js", "services/jobs/importJob.js", "client/src/components/PostingPanel.jsx"]) {
    assert.match(read(f), /shared\/postingNormalize\.js/, `${f} does not use the one normaliser`);
  }
  // 44p (changed on purpose): 500 a pass, the first slice only — the stale scan over the whole board is the cost (≈ 4 s at 81k).
  assert.match(read("server.js"), /backfillDescriptionText\(db, \{ dryRun: false, limit: 500, ceiling: 500 \}\)/, "the boot / interval pass runs it");
  // ⛔ no source renders posting HTML as HTML.
  for (const f of ["client/src/components/PostingPanel.jsx", "client/src/components/JobDetailPanel.jsx", "client/src/views/DeckView.jsx"]) {
    if (fs.existsSync(f)) assert.doesNotMatch(read(f), /dangerouslySetInnerHTML/, `${f} injects HTML`);
  }
  assert.equal(formatPosting(normalizePosting(RTX_HTML).text)[0].type, "h");
});

// D59's browser pass (10-07): the hostile and Blue Origin postings state no workstyle, yet the deck said
// "On-site" — mapJobRow sends remote:false for an unknown (Boolean(null)) and the board read false as
// on-site. "Not remote" is not "on-site"; only a stated workstyle is shown.
test("⛔ D59 · an UNSTATED workstyle is not shown as On-site — remote:false says nothing", () => {
  const src = fs.readFileSync(path.join("client", "src", "panels", "JobsPanel.jsx"), "utf8");
  const line = src.split(/\r?\n/).find(l => /^\s*workType:\s+job\.workType\s+\?\?/.test(l));
  assert.ok(line, "normalizeApiJob's workType line");
  assert.doesNotMatch(line, /On-site/, "remote === false must not become \"On-site\"");
  assert.match(line, /remote === true \? "Remote"/);
});

// The owner's answers to D59's questions, 10-07 (38): the grade export stays RAW; "unspecified" stays;
// Marlborough is Marlborough — not Greater Boston.
test("D59 · the owner's answers — the grade export reads the RAW description; Marlborough is not in the Boston metro", async () => {
  const transfer = read("services/jobs/atsGradeTransfer.js");
  assert.doesNotMatch(transfer, /description_text|withPostingText|postingText\(/, "the grade export keeps the raw text the grades were made against");
  const { METROS } = await import("../shared/jobTagVocabulary.js");
  const boston = METROS.find(m => m.value === "boston");
  assert.ok(boston);
  assert.equal(boston.cities.some(([c]) => c === "marlborough"), false, "Marlborough is not Greater Boston (owner)");
  assert.ok(CLEARANCE_LEVELS_INCLUDE_UNSPECIFIED());
});
function CLEARANCE_LEVELS_INCLUDE_UNSPECIFIED() {
  return read("shared/postingRequirements.js").includes('"unspecified"');
}
