// A111 P1 (D127 P2): merge the probe rounds into probe.json; write live.json (every live board with in-category postings)
// and approve-me.json (the KEEP list the owner approves: live, the intended employer, ≥ KEEP_MIN US postings within the
// age limit that categoryOf places in a TARGET category, one board per company, not already on the D126 list).
import fs from "node:fs";
const rd = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), "utf8"));
const exists = f => fs.existsSync(new URL(f, import.meta.url));
const ROUNDS = ["./probe-r1.json", "./probe-r2.json"].filter(exists);
const rows = ROUNDS.flatMap((f, i) => rd(f).map(r => ({ round: i + 1, ...r })));
export const TARGET = ["business", "management", "marketing", "sales", "legal", "arts_media", "science"];
const KEEP_MIN = 5;

// Boards that answered but are NOT the intended employer (checked by the board's own company name / job titles).
const WRONG = {};
const UNSURE = {};
// The intended employer, but its in-category postings would leak another group (e.g. retail store roles read as sales).
const HOLD = {};
try { const w = rd("./wrong.json"); Object.assign(WRONG, w.wrong || {}); Object.assign(UNSURE, w.unsure || {}); Object.assign(HOLD, w.hold || {}); } catch { /* none yet */ }
// Already proposed by D126 (engineering employers) — not proposed twice.
const d126 = (() => { try { return new Set(JSON.parse(fs.readFileSync(new URL("../d126/approve-me.json", import.meta.url), "utf8"))
  .map(r => `${r.ats_type}:${String(r.ats_slug).toLowerCase()}`)); } catch { return new Set(); } })();

for (const r of rows) {
  const k = `${r.atsType}:${String(r.slug).toLowerCase()}`;
  if (WRONG[k]) { r.wrongEmployer = true; r.note = WRONG[k]; }
  else if (HOLD[k]) { r.held_for_review = true; r.note = HOLD[k]; }
  else if (UNSURE[k]) r.note = UNSURE[k];
  if (d126.has(k)) r.onD126 = true;
}
rows.sort((a, b) => (b.target ?? -1) - (a.target ?? -1));
fs.writeFileSync(new URL("./probe.json", import.meta.url), JSON.stringify(rows, null, 1));

const live = rows.filter(r => r.state === "live" && r.target > 0 && !r.wrongEmployer && !r.onD126)
  .map(({ company, boardName, atsType, slug, fetched, us, fresh, cs, csOpen, target, held, byCategory, heldByReason, sample, note }) =>
    ({ company, boardName, atsType, slug, fetched, us, fresh, cs, csOpen, target, held, byCategory, heldByReason, sample, ...(note ? { note } : {}) }));
fs.writeFileSync(new URL("./live.json", import.meta.url), JSON.stringify(live, null, 1));

const seen = new Set();
const heldForReview = new Set(rows.filter(r => r.held_for_review).map(r => `${r.atsType}:${r.slug}`));
const keep = live.filter(r => r.target >= KEEP_MIN && !heldForReview.has(`${r.atsType}:${r.slug}`) && !seen.has(r.company) && seen.add(r.company));
if (heldForReview.size) console.log("held for review (not proposed):", [...heldForReview].join(", "));
const approve = keep.map(r => ({ company: r.company, ats_type: r.atsType, ats_slug: r.slug, in_scope: r.cs, in_category: r.target,
  by_category: Object.fromEntries(TARGET.filter(c => r.byCategory?.[c]).map(c => [c, r.byCategory[c]])), held: r.held,
  ...(r.note ? { note: r.note } : {}) }));
fs.writeFileSync(new URL("./approve-me.json", import.meta.url), JSON.stringify(approve, null, 1));

const sum = (list, f) => list.reduce((s, r) => s + (f(r) || 0), 0);
console.log(`probed ${rows.length} boards (${new Set(rows.map(r => r.company)).size} company names) in ${ROUNDS.length} round(s)`);
console.log("states:", rows.reduce((t, r) => ((t[r.state] = (t[r.state] || 0) + 1), t), {}));
console.log(`live with in-category postings: ${live.length} boards · KEEP (>= ${KEEP_MIN}, one per company): ${keep.length}`);
const perCat = Object.fromEntries(TARGET.map(c => [c, { employers: keep.filter(r => r.byCategory?.[c] > 0).length,
  employers5: keep.filter(r => r.byCategory?.[c] >= 5).length, postings: sum(keep, r => r.byCategory?.[c]) }]));
console.log("per category (kept):", JSON.stringify(perCat));
console.log(`kept: in-category ${sum(keep, r => r.target)} · held ${sum(keep, r => r.held)} · in-scope (any category) ${sum(keep, r => r.cs)}`);
console.log("kept by ats:", keep.reduce((t, r) => ((t[r.atsType] = (t[r.atsType] || 0) + 1), t), {}));
keep.forEach((r, i) => console.log(`${i + 1}. ${r.company} · ${r.atsType}:${r.slug} · ${r.target} ${JSON.stringify(r.byCategory)}${r.note ? " (" + r.note + ")" : ""}`));
