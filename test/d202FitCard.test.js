// ⭐ D202 (owner 11-25) · THE FIELD CARD ⇄ THE ATS CARD — one card, two faces (client/src/plate/FitCard.jsx), and
// ⭐ D199 C7 · THE OPENING SHEET at /app/jobs/<id> (client/src/plate/OpeningSheet.jsx), the card as its section 02.
//   d202FrontKeepsFieldCard · d202TurnOverKeepsOptionC · d202EveryWordListed · d202WordShowsWhereOnResume ·
//   d202ClaimUpdatesCountBarGroups · d202ContextShowsParts · d202OneComponentTwoPlaces · d199OpeningSheetRoute
// Fast tier: the pure model (shared/fitCardModel.js, services/fitCard.js) and the components rendered to static markup by
// esbuild + react-dom/server (as test-support/renderPlate.mjs does) with the boards' example data (plate/fitCardFixtures.jsx).
// The pixels are scripts/d196Regress.mjs's fit-* / op-* pairs (F5).
// ⛔ Verified to fail before it was committed: the words tab rendering only tier1 terms (d202EveryWordListed named the
// dropped verbs and qualities), and toggleClaim left out of the count (d202ClaimUpdatesCountBarGroups read 25 of 38).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fitCardModel, initialClaims, toggleClaim, contextView, FIT_GROUPS, fitGroupOf, filterCount } from "../shared/fitCardModel.js";
import { whereOnResume, fitCardPayload, termMatcher } from "../services/fitCard.js";
import { at } from "../test-support/sourceAnchors.js";

const ROOT = process.cwd();
const CLIENT = path.join(ROOT, "client");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

let bundle = null;
async function load() {
  if (bundle) return bundle;
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const src = path.join(CLIENT, "src");
  const out = path.join(ROOT, "tmp", "d202-render", `fit-${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const j = (f) => JSON.stringify(path.join(src, f));
  await esbuild.build({
    stdin: { resolveDir: CLIENT, loader: "jsx", contents: `
      import * as React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { MemoryRouter } from "react-router-dom";
      import { FitCard } from ${j("plate/FitCard.jsx")};
      import { OpeningSheetView, OPENING_ROUTE, openingSheetHref, openingSheetModel, numberWords, possessive, openingFromJob } from ${j("plate/OpeningSheet.jsx")};
      import { BOARD_FIT, BOARD_OPENING, BOARD_COMPANY } from ${j("plate/fitCardFixtures.jsx")};
      export { BOARD_FIT, BOARD_OPENING, BOARD_COMPANY, OPENING_ROUTE, openingSheetHref, openingSheetModel, numberWords, possessive, openingFromJob };
      export const card = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(FitCard, props)));
      export const sheet = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(OpeningSheetView, props)));
    ` },
    bundle: true, platform: "node", format: "esm", outfile: out, jsx: "automatic", logLevel: "silent",
    loader: { ".css": "empty", ".woff2": "empty", ".woff": "empty" }, define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [path.join(CLIENT, "node_modules")],
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  bundle = await import(pathToFileURL(out).href);
  return bundle;
}
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const FRONT = {
  alike: ["Role and level: frontend, mid — the same as yours"],
  gaps: [{ text: "They watch the front end with Datadog RUM.", link: { label: "Learn it →", href: "#atlas" } }],
  figures: { label: "ROLE FIT · STACK · DUTIES", value: "91 · 88 · 80", items: [{ label: "ROLE FIT", key: "role", value: 91 }, { label: "STACK", key: "stack", value: 88 }, { label: "DUTIES", key: "duties", value: 80 }] },
};

test("D202 · d202FrontKeepsFieldCard — the front IS the field card (its look and words), opening on the count and the bar", async () => {
  const B = await load();
  const html = B.card({ data: B.BOARD_FIT, ...FRONT });
  const t = text(html);
  for (const w of ["FIELD CARD · WHY IT FITS", "NO AI", "LINES UP", "DOESN’T, YET", "Learn it →", "ROLE FIT", "STACK", "DUTIES", "25 of 38 things", "66 %",
    "■ ON YOUR RÉSUMÉ", "■ CLAIMED BY YOU", "□ MISSING", "↻ Turn over · the full ATS card"]) assert.ok(t.includes(w), `the front lacks “${w}”`);
  assert.match(html, /class="pl-card pl-fieldcard pl-fitcard/, "the front is the field card's own aside");
  // one implementation: FitCard draws the front with Cards.jsx's FieldCard, never a copy of it
  const src = read("client/src/plate/FitCard.jsx");
  assert.match(src, /import \{ FieldCard \} from "\.\/Cards\.jsx"/);
  assert.ok(!/pl-card__strip/.test(src), "the front's strip is FieldCard's, not re-drawn in FitCard");
  // the count sits above the field card's lines (the lead slot), the Turn over below its scores (the foot slot)
  assert.ok(html.indexOf("25 of 38 things") < html.indexOf("LINES UP") && html.indexOf("ROLE FIT") < html.indexOf("Turn over"));
});

test("D202 · d202TurnOverKeepsOptionC — the back is today's ATS card word for word, + Every word and Context", async () => {
  const B = await load();
  const t = text(B.card({ data: B.BOARD_FIT, face: "back", tab: "words" }));
  for (const w of ["THE ATS CARD · YOUR RÉSUMÉ AGAINST THIS JOB", "↻ Back to the field card", "25 of 38 things this posting asks for",
    "A 66 % match. The score is still being tuned, so read it with the count.", "■ ON YOUR RÉSUMÉ", "■ CLAIMED BY YOU", "□ MISSING",
    "Every word · 38", "Context", "You could claim · 13", "History",
    "Claiming says it’s true of you: it counts toward this score and where jobs rank, and it’s used in résumés made from now on. It never rewrites one you already have, and you can withdraw it any time."])
    assert.ok(t.includes(w), `the back lacks “${w}”`);
  const claim = text(B.card({ data: B.BOARD_FIT, face: "back", tab: "claim" }));
  assert.ok(claim.includes("Claim only the ones that are true of you") && (claim.match(/That’s true of me/g) || []).length === 13);
  const hist = text(B.card({ data: B.BOARD_FIT, face: "back", tab: "hist", historyLines: [{ label: "First posted", text: "2 hours ago." }] }));
  assert.ok(hist.includes("First posted 2 hours ago."));
  // a declined report says so in words, never a number
  const declined = text(B.card({ data: { ...B.BOARD_FIT, report: { ...B.BOARD_FIT.report, score: null } }, face: "back" }));
  assert.ok(declined.includes("Not enough signal for a number yet") && !/A null/.test(declined));
});

test("D202 · d202EveryWordListed — every term the scorer read appears, grouped, none dropped", async () => {
  const report = { score: 50, tier1_matched: ["react", "postgresql", "payments"], tier1_missing: ["rust", "kubernetes"], competencies_matched: ["ownership"],
    competencies_missing: ["mentoring"], action_verbs_matched: ["design"], action_verbs_missing: ["migrate"], action_verbs_generic: ["manage", "work"],
    experience: { summary: "3+ years asked · you show 4", requiredYears: 3, candidateYears: 4 } };
  const m = fitCardModel({ report });
  const all = [...report.tier1_matched, ...report.tier1_missing, ...report.competencies_matched, ...report.competencies_missing, ...report.action_verbs_matched, ...report.action_verbs_missing];
  assert.equal(m.total, all.length);
  assert.deepEqual(m.words.map((w) => w.term).sort(), [...all].sort(), "every ask, once");
  assert.deepEqual(m.groups.map((g) => g.name), FIT_GROUPS.map((g) => g.name));
  assert.deepEqual(m.groups.map((g) => g.name), ["Languages & frameworks", "Tools & platforms", "Duties", "Domain", "Level, years & education"]);
  assert.equal(m.groups.reduce((n, g) => n + g.total, 0), m.total, "the groups hold every word");
  assert.equal(fitGroupOf({ term: "react", kind: "skill" }), "lang");
  assert.equal(fitGroupOf({ term: "kubernetes", kind: "skill" }), "tools");
  assert.equal(fitGroupOf({ term: "payments", kind: "skill" }), "domain");
  assert.equal(fitGroupOf({ term: "design", kind: "verb" }), "duties");
  assert.equal(fitGroupOf({ term: "ownership", kind: "quality" }), "level");
  assert.deepEqual(m.generic, ["Manage", "Work"], "general language is listed apart, never an ask");
  assert.ok(m.facts.some((f) => f.group === "level" && /3\+ years/.test(f.text)), "years sit in the Level group");
  assert.equal(filterCount(m, "all"), 9); assert.equal(filterCount(m, "missing"), 4); assert.equal(filterCount(m, "on"), 5);
  // the board's 38, rendered: every label on the words tab, each group with its "N OF M"
  const B = await load();
  const html = B.card({ data: B.BOARD_FIT, face: "back", tab: "words" });
  const r = B.BOARD_FIT.report;
  for (const term of [...r.tier1_matched, ...r.tier1_missing, ...r.action_verbs_matched, ...r.action_verbs_missing, ...r.competencies_matched, ...r.competencies_missing])
    assert.ok(text(html).includes(term), `the words tab dropped “${term}”`);
  for (const c of ["8 OF 10", "6 OF 10", "6 OF 8", "1 OF 4", "4 OF 6"]) assert.ok(text(html).includes(c), `no group count ${c}`);
  for (const f of ["All · 38", "Missing · 13", "On your résumé · 25", "Claimed · 0"]) assert.ok(text(html).includes(f), `no filter ${f}`);
});

test("D202 · d202WordShowsWhereOnResume — a found word says where it sits (“Toast · bullet 2”)", async () => {
  const resume = ["Maya Chen", "SUMMARY", "Frontend engineer.", "EXPERIENCE", "Software Engineer II — Toast", "Jan 2021 - Present",
    "- Rebuilt checkout in React and Next.js", "- Designed the GraphQL layer for menus", "Software Engineer — HubSpot", "2019 - 2021", "- Built Storybook components",
    "SKILLS", "Python, SQL, Git", "EDUCATION", "Northeastern University · BS Computer Science"].join("\n");
  const where = whereOnResume(resume, [{ term: "react", kind: "skill" }, { term: "graphql", kind: "skill" }, { term: "storybook", kind: "skill" },
    { term: "sql", kind: "skill" }, { term: "design", kind: "verb" }, { term: "computer science", kind: "skill" }, { term: "rust", kind: "skill" }]);
  assert.equal(where.react, "Toast · bullet 1");
  assert.equal(where.graphql, "Toast · bullet 2");
  assert.equal(where.storybook, "HubSpot · bullet 1");
  assert.equal(where.sql, "Skills");
  assert.equal(where.design, "Toast · bullet 2", "a verb in its -ed form");
  assert.equal(where["computer science"], "Education");
  assert.ok(!("rust" in where), "a word the résumé names nowhere has no place — never a guessed one");
  assert.ok(termMatcher("go").test("Built in Go") && !termMatcher("go").test("good"));
  const payload = fitCardPayload({ scored: { score: 60, report: { tier1_matched: ["react"], tier1_missing: [] }, contextual: null }, resumeText: resume, profileId: 7 });
  assert.deepEqual(payload.where, { react: "Toast · bullet 1" });
  assert.equal(payload.profileId, 7);
  assert.ok(payload.resumeTech.includes("React") && payload.resumeTech.includes("GraphQL"));
  // on the card: the place rides on the word (shown on hover / focus), and the server route serves it
  const B = await load();
  const html = B.card({ data: B.BOARD_FIT, face: "back", tab: "words" });
  assert.match(html, /data-fit-word="next\.js"[^>]*>.*?<span class="pl-fit__where" data-fit-where="">Toast · bullet 2<\/span>/);
  assert.match(html, /title="On your résumé: Toast · bullet 1"/);
  const server = read("server.js");
  assert.match(server, /app\.get\("\/api\/jobs\/:id\/fit-card", requireAuth/);
  assert.match(server, /fitCardPayload\(\{ scored: r, resumeText: text, profileId: profile\?\.id \?\? null \}\)/);
});

test("D202 · d202ClaimUpdatesCountBarGroups — a claim moves the count, the bar and the group counts at once", () => {
  const report = { score: 50, tier1_matched: ["react", "typescript"], tier1_missing: ["vue", "rust"], action_verbs_missing: ["mentor"], claimed_matches: [] };
  const before = fitCardModel({ report, claimed: initialClaims(report) });
  assert.deepEqual([before.on, before.claimed, before.missing, before.total], [2, 0, 3, 5]);
  const lang0 = before.groups.find((g) => g.id === "lang");
  assert.equal(`${lang0.have} OF ${lang0.total}`, "2 OF 4");
  const after = fitCardModel({ report, claimed: toggleClaim(initialClaims(report), "vue") });
  assert.deepEqual([after.on, after.claimed, after.missing], [2, 1, 2], "N of M counts the claim");
  assert.equal(after.clShare, 20, "the bar's clay segment");
  assert.equal(after.groups.find((g) => g.id === "lang").have, 3, "the group's N OF M");
  assert.equal(after.words.find((w) => w.key === "vue").state, "claimed");
  const undone = fitCardModel({ report, claimed: toggleClaim(toggleClaim(initialClaims(report), "vue"), "vue") });
  assert.equal(undone.claimed, 0, "undo withdraws it");
  // a term matched only on the person's word reads CLAIMED, and can be withdrawn
  const claimedBefore = fitCardModel({ report: { ...report, tier1_matched: ["react", "typescript", "vue"], tier1_missing: ["rust"], claimed_matches: ["vue"] } });
  assert.equal(claimedBefore.words.find((w) => w.key === "vue").state, "claimed");
  // the component: the claim set moves BEFORE the request (at once), the reversible AG2 call, then the card reads itself again
  const src = read("client/src/plate/FitCard.jsx");
  const body = src.slice(at(src, "const onClaim = useCallback"), at(src, "}, [d, jobId]);"));
  assert.ok(body.indexOf("setClaimed((c) => toggleClaim(c, w.key))") < body.indexOf("await setProfileClaim("), "the count moves before the server answers");
  assert.match(body, /setNonce\(\(n\) => n \+ 1\)/, "the number follows the claim (a fresh read)");
  assert.match(src, /import \{ setProfileClaim \} from "\.\.\/lib\/profileSuggestions\.js"/);
});

test("D202 · d202ContextShowsParts — D192's parts and weights, similarities / dissimilarities, their stack vs yours, plausibility", async () => {
  const B = await load();
  const v = contextView(B.BOARD_FIT.contextual, { resumeTech: B.BOARD_FIT.resumeTech });
  assert.deepEqual(v.parts.map((p) => `${p.name} ${p.weight} ${p.score}`), ["Skill match 50 % 86", "Role fit 20 % 91", "Stack 15 % 88", "Duties 15 % 80"]);
  assert.equal(v.score, 87);
  assert.deepEqual(v.stack.map((s) => s.kind), ["exact", "exact", "ecosystem", "gap", "extra"]);
  assert.ok(v.similar.includes("Same role and level: frontend, mid") && v.different.includes("Payments domain: yours was restaurants"));
  const noData = contextView({ score: 70, weights: {}, parts: { skill_match: { status: "ok", score: 70, weight: 1 }, role_fit: { status: "no_data", reason: "resume_not_placed" } } });
  assert.equal(noData.parts.find((p) => p.id === "role_fit").score, null, "a part with no data has no number");
  const t = text(B.card({ data: B.BOARD_FIT, face: "back", tab: "context", plausibility: { entries: [{ employer: "Toast", status: "all_confirmed", flags: [] }] }, company: "Kestrel Payments" }));
  for (const w of ["THE CONTEXTUAL SCORE · ITS PARTS AND WEIGHTS", "Skill match", "· 50 %", "Role fit", "· 20 %", "Contextual score", "87", "SIMILARITIES", "DISSIMILARITIES",
    "THEIR REAL STACK VS YOURS · FROM 9 Kestrel POSTINGS", "EXACT", "ECOSYSTEM", "GAP", "EXTRA", "Vite ← Webpack", "yours, not theirs — no penalty",
    "DOES IT ADD UP? · PLAUSIBILITY", "✓ Every checkable claim lines up with what Toast post. No flags."]) assert.ok(t.includes(w), `context lacks “${w}”`);
  // the stack comes from technographics (stackFor, through the contextual block's tech_stack) — never typed in
  assert.match(read("services/atsContextual.js"), /stackFor/);
});

test("D202 · d202OneComponentTwoPlaces — the same FitCard beside the deck and as the sheet's section 02", async () => {
  const sheetSrc = read("client/src/plate/OpeningSheet.jsx");
  assert.match(sheetSrc, /import FitCard, \{ fitCardFor \} from "\.\/FitCard\.jsx"/);
  assert.match(sheetSrc, /<FitCard jobId=/);
  // ⭐ 47h (D202 on the market): the market mounts the same component beside the deck — no FieldCard branch of its own
  const marketSrc = read("client/src/plate/MarketOpenings.jsx");
  assert.match(marketSrc, /import FitCard, \{ fitCardFor, withPartReasons \} from "\.\/FitCard\.jsx"/);
  assert.match(marketSrc, /return <FitCard key=\{front\.jobId\} jobId=\{front\.jobId\} company=\{front\.company\} brief=\{<CompanyBrief /);
  assert.ok(!/<FieldCard (?:alike|state="(?:loading|error|partial)")/.test(marketSrc), "no field card of its own on the market");
  // drop-in where the field card was: the market's own props (alike / gaps / figures + the states) render on FitCard
  const B = await load();
  for (const s of ["loading", "error", "empty"]) assert.ok(B.card({ state: s, errorText: "x", emptyText: "y" }).length > 0);
  assert.match(B.card({ state: "loading" }), /aria-busy="true"/);
  assert.ok(text(B.card({ data: B.BOARD_FIT, ...FRONT })).includes("Role and level: frontend, mid — the same as yours"));
  // no third version: one component named FitCard, and nothing else in the client prints the ATS card's words (they are
  // shared/fitCardModel.js fitWords — test/atsReportOneImplementation.test.js holds the client to that)
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.jsx$/.test(e.name)) files.push(p); } };
  walk(path.join(CLIENT, "src"));
  const defs = files.filter((f) => /export (?:default )?function FitCard\b/.test(fs.readFileSync(f, "utf8")));
  assert.equal(defs.length, 1, defs.join(", "));
  const code = (f) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");   // comments may name it
  const asks = files.filter((f) => /things this posting asks for/.test(code(f)) &&!/fitCardFixtures/.test(f)).map((f) => path.relative(CLIENT, f).split(path.sep).join("/"));
  assert.deepEqual(asks.filter((f) => !/components\/AtsReport\.jsx$/.test(f)), []);
  assert.match(read("shared/fitCardModel.js"), /things this posting asks for/);
  assert.match(read("client/src/plate/FitCard.jsx"), /fitWords\(model\)/);
  // the sheet's section 02 renders the card (front, with Turn over)
  const html = B.sheet({ data: B.BOARD_OPENING, company: B.BOARD_COMPANY, fit: B.BOARD_FIT, still: true });
  const fit = html.slice(at(html, 'data-opening-fit=""'), at(html, 'aria-labelledby="op-stack"'));
  assert.match(fit, /class="pl-card pl-fieldcard pl-fitcard"/);
  assert.ok(text(fit).includes("↻ Turn over · the full ATS card"));
});

test("D199 C7 · d199OpeningSheetRoute — /app/jobs/<id> is the sheet, over the market, with every action", async () => {
  const B = await load();
  assert.equal(B.OPENING_ROUTE.exec("jobs/abc-123")?.[1], "abc-123");
  assert.equal(B.OPENING_ROUTE.exec("jobs"), null, "the bare board stays the market");
  assert.equal(B.OPENING_ROUTE.exec("jobs/a/b"), null);
  assert.equal(B.openingSheetHref("x y"), "/app/jobs/x%20y");
  assert.equal(B.numberWords(91), "Ninety-one"); assert.equal(B.numberWords(40), "Forty"); assert.equal(B.numberWords(100), "One hundred");
  assert.equal(B.possessive("Kestrel Payments"), "Kestrel Payments’"); assert.equal(B.possessive("Toast"), "Toast’s");
  // App: the route keeps the market mounted (activeTab "console") and draws the sheet over it; never bounced to the board
  const app = read("client/src/App.jsx");
  assert.match(app, /const openingRoute = OPENING_ROUTE\.exec\(routeKey\);/);
  assert.match(app, /: openingRoute \|\| routeKey === CONSOLE_ROUTE \|\| LEGACY_CONSOLE_ROUTES\.has\(routeKey\)/);
  assert.match(app, /&& !openingRoute && routeKey !== CONSOLE_ROUTE/);
  assert.match(app, /\{openingRoute && <OpeningSheet jobId=\{decodeURIComponent\(openingRoute\[1\]\)\}\/>\}/);
  const html = B.sheet({ data: B.BOARD_OPENING, company: B.BOARD_COMPANY, fit: B.BOARD_FIT, still: true });
  const t = text(html);
  for (const w of ["MKT", "SOFTWARE ENG. › FRONTEND", "KESTREL PAYMENTS", "FRONTEND ENGINEER II", "← Back to the market", "OPENING SHEET", "POSTED 2 H AGO", "LIVE · CHECKED TODAY",
    "Kestrel Payments", "Boston, MA · Hybrid", "Frontend Engineer II, Checkout", "$150k–$180k", "PAY, POSTED", "Full-time", "Mid", "STACK YOU HAVE", "FILED H-1B · FY25",
    "What you’d do", "MUST HAVE", "NICE TO HAVE", "Ninety-one, and why", "What Kestrel Payments builds with", "Read it all", "About the team", "What you’ll do",
    "Who you’d be joining", "VISA SPONSORSHIP · DOL DATA", "Past filings, not a promise to sponsor you.", "Open the survey sheet →", "Open the original posting ↗", "91 MATCH"])
    assert.ok(t.includes(w), `the sheet lacks “${w}”`);
  // 04: nothing cut — every word of the posting is on the sheet, in order
  const words = B.BOARD_OPENING.description.split(/\s+/).filter(Boolean);
  const posting = text(html.slice(at(html, 'data-opening-posting=""')));
  let pos = 0; for (const w of words) { const i = posting.indexOf(w, pos); assert.ok(i >= 0, `the posting lost “${w}”`); pos = i; }
  // the action bar: the deck's own Pass · Save · Send · Draft (TicketActions), wired to the board's decide
  for (const a of ["pass", "save", "send", "draft"]) assert.match(html, new RegExp(`data-deck-action="${a}"`));
  const src = read("client/src/plate/OpeningSheet.jsx");
  assert.match(src, /import \{ TicketActions, openingFromCard \} from "\.\/MarketCardFace\.jsx"/);
  assert.match(src, /assistantAction\("boardDecide"\)/);
  assert.match(src, /e\.key === "Escape"/);
  assert.match(src, /navigate\(-1\)/, "Back returns to the market as it was");
  // R2: no pay → said, no filings → no stamp
  const bare = text(B.sheet({ data: { ...B.BOARD_OPENING, pay: null, sponsors: false }, company: { stack: null }, still: true }));
  assert.ok(bare.includes("Not posted") && !bare.includes("FILED H-1B") && bare.includes("No filings found"));
  const m = B.openingSheetModel({ opening: B.BOARD_OPENING, company: B.BOARD_COMPANY, fit: B.BOARD_FIT });
  assert.equal(m.stack[0].name, "TypeScript", "their stack by share");
  assert.equal(m.tail[0].title, "Benefits and the equal-opportunity statement", "the boilerplate folds, kept whole");
});

// ⛔ A246 (47j): the LIVE path — a raw job from GET /api/jobs/by-id → openingFromJob → the sheet. The view read `data?.job ||
// data` and openingFromJob carried the raw job as `job`, so production drew the raw job (no place, pay, type, posted).
test("a246OpeningSheetReadsTheOpening: a raw job read by id draws its place, pay, type and posted on the sheet", async () => {
  const B = await load();
  const now = Date.parse("2026-11-26T12:00:00Z");
  const raw = { jobId: "j0", id: "j0", company: "Northwind", title: "Senior Data Engineer", location: "Boston, MA", workType: "Hybrid",
    contractType: "Full-time", salaryMin: 165000, salaryMax: 190000, postedAt: "2026-11-26T03:00:00Z", description: "" };
  const o = B.openingFromJob(raw, now);
  assert.equal(o.job, undefined, "the raw job is not carried as `job`");
  assert.equal(o.raw, raw);
  const t = text(B.sheet({ data: o, still: true }));
  for (const want of ["Boston, MA", "$165k–$190k", "Full-time"]) assert.ok(t.includes(want), `the sheet shows ${want}`);
  assert.ok(!t.includes("Not posted"), "the pay is posted");
  assert.match(t, /POSTED/i, "the posted kicker");
});
