// THE COLOUR-LITERAL GUARD — no NEW colour literal outside styles/colorTokens.js.
// ================================================================================================
//
// docs/UI_REDESIGN.md: "⛔ every colour is a token from day one … Dark mode later means re-pointing
// tokens, not hunting literals." Step 2 introduced the tokens and migrated the shell, the public
// pages and the shared surfaces. The authenticated panels still carry literals, and migrating them
// is not one pass. So this guard is a RATCHET, modelled on test/brandAndOriginGuard.test.js:
//
//   1. A file not in BUDGET may carry ZERO colour literals. A new file, or a clean file that grows
//      one, fails here and names itself.
//   2. A file in BUDGET may carry exactly its budget and no more.
//   3. ⛔ THE BUDGET PRUNES ITSELF. A file that has dropped BELOW its budget fails too, and says
//      "lower the number". A budget that outlives a cleanup would silently permit the literal to
//      come back — the same anti-rot rule as the brand guard's self-pruning allowlist. A file that
//      reaches zero must be DELETED from BUDGET.
//
// ⛔ THIS GUARD WAS VERIFIED TO FAIL BEFORE IT WAS COMMITTED, three ways: `color: "#123456"`
// injected into a clean file (components/Footer.jsx — failed "1 literal(s), budget 0", and the
// MIGRATED pin failed too); `const X = "#abcdef"` appended to a budgeted file (panels/PlansPanel.jsx
// — failed "2 literal(s), budget 1"); and PlansPanel's budget raised to 2 (failed "LOWER it to 1").
// With BUDGET empty the scan named all 22 files. Seven guards have shipped inert in this project. If you change the scanner, break
// it again on purpose and watch it fail before you trust it.
//
// WHAT COUNTS: hex (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba(), hsl()/hsla(), and quoted or
// CSS-valued `white`/`black` — in .js/.jsx/.ts/.tsx/.css under client/src, with comments stripped
// (a hex in a comment paints nothing, and the token file's own notes quote values in order to talk
// about them). Other named colours and Tailwind palette classes (`text-white`, `bg-red-500`) are NOT
// counted:
// measured at step 2, 13 Tailwind palette classes across 7 files, all inside vendored shadcn/ui
// primitives (components/ui/*). Recorded, not guarded — see docs/UI_REDESIGN.md's step 2 note.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = "client/src";
const TOKEN_FILE = "client/src/styles/colorTokens.js";
// Plus the two NAMED colours this client actually used as paint — quoted "white"/"black" in JS, and
// `: white;` in CSS. They were added to the scan after the first pass MISSED them: the login button
// and the "your next" hero tile carried color:"white" on the orange fill (3.47:1, fails AA),
// invisible to a hex/rgb/hsl-only scan. That is the "guard proving a sweep complete on the one
// component it could not see" failure, and it was caught by the screenshot, not by the guard.
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|(["'`])(?:white|black)\1|:\s*(?:white|black)\s*[;}!]/g;

// Block comments, then line comments — but not the `//` inside `http://` or a string.
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

function sourceFiles(dir = ROOT) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(jsx?|tsx?|css)$/.test(e.name)) out.push(p.split(path.sep).join("/"));
  }
  return out;
}

export function literalCounts() {
  const counts = {};
  for (const f of sourceFiles()) {
    if (f === TOKEN_FILE) continue;
    const n = (stripComments(fs.readFileSync(f, "utf8")).match(LITERAL) || []).length;
    if (n) counts[f] = n;
  }
  return counts;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE BUDGET. Each number is the count MEASURED when the entry was last touched. Lower it as files
// are migrated; the pruning test below insists on it. ⛔ Never RAISE a number to make a failure go
// away: that is adding a literal, which is the thing this file exists to stop. Add a token instead.
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Permanent entries, each with its reason. These are not "not yet migrated"; they are decided.
 */
const PERMANENT = {
  "client/src/components/DockPortal.jsx":
    "Kept unchanged by the redesign (the portalled listbox). Its three literals are FALLBACKS for a " +
    "caller that passes no theme; every caller passes one. Remove them if DockPortal is next edited " +
    "for any other reason — the budget below will then insist the entry goes.",
  "client/src/components/ui/chart.jsx":
    "Vendored shadcn/ui chart primitive. Its literals are recharts selector strings " +
    "(`[stroke='#ccc']`) that MATCH recharts' own defaults in order to restyle them — replacing them " +
    "with tokens would make the selectors stop matching.",
};

/** Not yet migrated. EMPTY since UI step 2b (09-30) — kept as the place a new exception would be argued. */
// Measured 2026-09-29 at step 2: 554 literals in 22 files (from 887 in 60 before step 2). Step 2b
// (09-30) migrated all 22 — 549 literals by AST position, the token chosen by the CSS role each
// literal played, because the dark -> light flip inverts the neutrals (dark-era "#fff" text is ink
// now, a "#0f0f0f" fill is paper). ⛔ Adding an entry here is adding a literal. Add a token instead.
const BUDGET = {};

// ════════════════════════════════════════════════════════════════════════════════════════════

test("the scanner works — it finds the token file's own values and the known budgeted files", () => {
  // A zero-hit scan is a broken scan, not a clean tree.
  const tokenHits = (stripComments(fs.readFileSync(TOKEN_FILE, "utf8")).match(LITERAL) || []).length;
  assert.ok(tokenHits >= 30, `the scanner found only ${tokenHits} literals in the token file itself`);
  assert.ok(sourceFiles().length > 100, "the client/src walk found almost nothing");
  // Comments are stripped, strings with // are not truncated.
  assert.equal((stripComments('a: "#abcdef"; // #123456').match(LITERAL) || []).length, 1);
  assert.equal((stripComments('url("http://x/#fff")').match(LITERAL) || []).length, 1);
  assert.equal((stripComments("/* #fff */ color: rgba(0,0,0,.1)").match(LITERAL) || []).length, 1);
  assert.equal(('color:"white", whiteSpace:"nowrap"'.match(LITERAL) || []).length, 1);
  assert.equal(("a { color: black; }".match(LITERAL) || []).length, 1);
});

test("⛔ no colour literal outside styles/colorTokens.js, beyond the measured budget", () => {
  const counts = literalCounts();
  const over = [];
  for (const [f, n] of Object.entries(counts)) {
    if (f in PERMANENT) continue;
    const allowed = BUDGET[f] ?? 0;
    if (n > allowed) over.push(`${f}: ${n} literal(s), budget ${allowed}`);
  }
  assert.deepEqual(over, [],
    "a colour literal was ADDED. Use a token from client/src/styles/colorTokens.js (import { C }, " +
    "or var(--c-*) in CSS) — and if no token fits, add one there, with its contrast pair");
});

test("the budget prunes itself — no entry is looser than the file it covers", () => {
  const counts = literalCounts();
  const stale = [];
  for (const [f, n] of Object.entries(BUDGET)) {
    const actual = counts[f] ?? 0;
    if (actual === 0) stale.push(`${f}: clean now — DELETE its BUDGET entry`);
    else if (actual < n) stale.push(`${f}: ${actual} literal(s), budget ${n} — LOWER it to ${actual}`);
  }
  for (const f of Object.keys(PERMANENT)) {
    if (!counts[f]) stale.push(`${f}: PERMANENT but carries no literal — delete the entry`);
  }
  assert.deepEqual(stale, []);
  for (const f of Object.keys(BUDGET)) assert.ok(!(f in PERMANENT), `${f} is in both lists`);
});

test("the shell, the public pages and the shared surfaces are literal-free", () => {
  // Step 2's migrated set, pinned by name so a later budget entry cannot quietly re-admit one of
  // them. These are what a signed-out visitor sees, plus the chrome every signed-in page shares.
  const counts = literalCounts();
  const MIGRATED = [
    "client/src/index.css", "client/src/App.jsx", "client/src/styles/theme.jsx",
    "client/src/themes/cinematic.js", "client/src/components/PaperBackground.jsx",
    "client/src/components/NavBar.css", "client/src/pages/LandingPage.css",
    "client/src/components/UnifiedSearchBar.css", "client/src/components/TopBar.jsx",
    "client/src/components/Footer.jsx", "client/src/components/ScrollDock.jsx",
    "client/src/components/AuthScreen.jsx", "client/src/components/CTAButton.jsx",
    "client/src/components/PanelShell.jsx", "client/src/components/ui/PanelControls.jsx",
    "client/src/components/UsbSelect.jsx", "client/src/components/UsbSuggest.jsx",
    "client/src/pages/tools/ATSToolPage.jsx", "client/src/pages/tools/GenerateToolPage.jsx",
    "client/src/pages/tools/ApplyToolPage.jsx", "client/src/pages/NotFoundPage.jsx",
    "client/src/pages/BlogPage.jsx", "client/src/pages/ProductsPage.jsx",
    "client/src/pages/marketing/PricingPage.jsx", "client/src/pages/marketing/ContactPage.jsx",
    "client/src/pages/marketing/FeaturesPage.jsx", "client/src/pages/AdminLoginPage.jsx",
    "client/src/components/InlineLoginPopover.jsx", "client/src/components/BelowFoldContent.jsx",
    "client/src/components/ProfileSelectorDropdown.jsx", "client/src/components/MetaChips.jsx",
    "client/src/components/CountdownDisplay.jsx", "client/src/components/AdminLayout.jsx",
    "client/src/components/ui/TileCard.jsx", "client/src/components/ui/DateCalendar.jsx",
    // Step 2b (09-30): the signed-in app — the 22 files the budget held.
    "client/src/pages/admin/DBInspector.jsx", "client/src/panels/AutoApplyPanel.jsx",
    "client/src/panels/JobsPanel.jsx", "client/src/panels/AutoApplyPanelSections.jsx",
    "client/src/components/JobCard.jsx", "client/src/panels/AdminPanel.jsx",
    "client/src/components/JobDetailPanel.jsx", "client/src/panels/ATSPanel.jsx",
    "client/src/lib/applyObstacles.js", "client/src/panels/RecruiterPanel.jsx",
    "client/src/panels/IntegrationsPanel.jsx", "client/src/components/CompanyKbSections.jsx",
    "client/src/panels/SandboxPanel.jsx", "client/src/components/ImportJobModal.jsx",
    "client/src/components/ui/CompanyIcon.jsx", "client/src/components/DomainProfileWizard.jsx",
    "client/src/components/CoverLetterModal.jsx", "client/src/components/CompanyViewModal.jsx",
    "client/src/panels/AtsReportPanel.jsx", "client/src/panels/DatabasePanel.jsx",
    "client/src/panels/JobProfilesPanel.jsx", "client/src/panels/PlansPanel.jsx",
    "client/src/styles/bandStyle.js",
  ];
  for (const f of MIGRATED) {
    assert.ok(fs.existsSync(f), `${f} moved — re-point this list`);
    assert.equal(counts[f] ?? 0, 0, `${f} carries a colour literal again`);
    assert.ok(!(f in BUDGET), `${f} was re-admitted to the budget`);
  }
});

export { BUDGET, PERMANENT };
