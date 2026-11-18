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
// D91: the palettes moved into one file per theme (client/src/themes/<id>.js). Exempt is exactly what
// the REGISTRY imports — a file merely dropped into themes/ is scanned like any other.
export const THEME_FILES = new Set([...fs.readFileSync("client/src/themes/index.js", "utf8")
  .matchAll(/^import \w+ from "\.\/([\w-]+\.js)";$/gm)].map((m) => `client/src/themes/${m[1]}`));
// ⭐ T9: the ATS report component's token VALUES are GENERATED from the registry (scripts/buildAtsReport.mjs) — a copy
// the generator writes and test/t9AtsReportComponent.test.js holds byte-equal to the theme files, not a palette.
export const GENERATED_TOKEN_FILES = new Set(["shared/atsReportTokens.js"]);
const TOKEN_FILES = new Set([TOKEN_FILE, ...THEME_FILES, ...GENERATED_TOKEN_FILES]);
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

// ⭐ D91 P2 (10-11): the scan reached only client/src, and the audit (docs/THEME_AUDIT.md §1) found what
// that hid — shared/applicationResponse.js carried raw Tailwind hex that The Table painted, outside every
// token and contrast pair, and client/index.html a dead dark-era rule. So the scan now also reads the
// page shell and EVERY shared/ module the client imports (transitively), with HTML comments stripped.
export function sharedImportedByClient() {
  const seen = new Set();
  const queue = sourceFiles().filter((f) => /\.(jsx?|tsx?)$/.test(f));
  while (queue.length) {
    const f = queue.pop();
    for (const m of fs.readFileSync(f, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
      if (!m[1].startsWith(".")) continue;
      const p = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
      if (p.startsWith("shared/") && fs.existsSync(p) && !seen.has(p)) { seen.add(p); queue.push(p); }
    }
  }
  return [...seen].sort();
}
const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

export function literalCounts() {
  const counts = {};
  for (const f of [...sourceFiles(), "client/index.html", ...sharedImportedByClient()]) {
    if (TOKEN_FILES.has(f)) continue;
    const n = (stripComments(stripHtml(fs.readFileSync(f, "utf8"))).match(LITERAL) || []).length;
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
  // D91 P2 (10-11): DockPortal's three dark-era fallbacks became tokens — the entry went with them.
  // A93 (10-07): ui/chart.jsx deleted — no importer.
  // ⭐ 46n (owner 11-15: "make tiny a floating bot … give it a cute logo animal"): Tiny's fox is an ILLUSTRATION, not theme —
  // like a logo it is the same orange fox in every theme, and it is drawn once here and mirrored byte-identical into the
  // extension and the PDF-tools site (which has no draft tokens at all), so its colours cannot be draft's tokens. The number
  // is EXACT: one more literal (or one fewer) fails, so the file cannot become a place where theme colour hides.
  // ⭐ 46v 0c (owner 11-18): the fox is retired; the assistant's face is draft's "/d" in the theme's logo tokens — no
  // literal left, so the entry went with it (as DockPortal's did).
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
  // D91: every registered theme file is a palette — the walk must see each one, and the registry must
  // name at least the two themes the product shipped with.
  assert.ok(THEME_FILES.has("client/src/themes/paper-light.js") && THEME_FILES.has("client/src/themes/charcoal-dark.js"),
    `the registry scan found ${[...THEME_FILES].join(", ") || "no theme file"}`);
  for (const t of THEME_FILES) {
    const tokenHits = (stripComments(fs.readFileSync(t, "utf8")).match(LITERAL) || []).length;
    assert.ok(tokenHits >= 30, `the scanner found only ${tokenHits} literals in the theme file ${t}`);
  }
  assert.ok(sourceFiles().length > 100, "the client/src walk found almost nothing");
  // D91 P2: the widened scan really reaches shared/ — the modules the audit found painted by the client.
  const shared = sharedImportedByClient();
  for (const f of ["shared/applicationResponse.js", "shared/atsBands.js"]) assert.ok(shared.includes(f), `the shared/ walk missed ${f}`);
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
    if (f in PERMANENT) { if (n !== PERMANENT[f]) over.push(`${f}: ${n} literal(s), PERMANENT at exactly ${PERMANENT[f]}`); continue; }
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
    "client/src/components/AuthScreen.jsx",
    "client/src/components/PanelShell.jsx", "client/src/components/ui/PanelControls.jsx",
    "client/src/components/UsbSelect.jsx", "client/src/components/UsbSuggest.jsx",
    "client/src/pages/tools/ATSToolPage.jsx", "client/src/pages/tools/GenerateToolPage.jsx",
    "client/src/pages/tools/ApplyToolPage.jsx", "client/src/pages/NotFoundPage.jsx",
    "client/src/pages/BlogPage.jsx", "client/src/pages/ProductsPage.jsx",
    "client/src/pages/marketing/PricingPage.jsx", "client/src/pages/marketing/ContactPage.jsx",
    "client/src/pages/marketing/FeaturesPage.jsx", "client/src/pages/AdminLoginPage.jsx",
    "client/src/components/InlineLoginPopover.jsx", "client/src/components/FindFitApply.jsx",   // was BelowFoldContent (queue 31)
    "client/src/components/ProfileSelectorDropdown.jsx",
    "client/src/components/AdminLayout.jsx",
    "client/src/components/ui/TileCard.jsx", "client/src/components/ui/DateCalendar.jsx",
    // Step 2b (09-30): the signed-in app — the 22 files the budget held.
    "client/src/pages/admin/DBInspector.jsx", "client/src/panels/AutoApplyPanel.jsx",
    "client/src/panels/JobsPanel.jsx", "client/src/panels/AutoApplyPanelSections.jsx",
    "client/src/components/JobCard.jsx", "client/src/panels/AdminPanel.jsx",
    "client/src/components/JobDetailPanel.jsx", "client/src/components/ATSPanel.jsx",
    "client/src/lib/applyObstacles.js", "client/src/panels/RecruiterPanel.jsx",
    "client/src/panels/IntegrationsPanel.jsx", "client/src/components/CompanyKbSections.jsx",
    "client/src/panels/SandboxPanel.jsx",   // ImportJobModal.jsx was here — deleted in D11 (no IMPORT control)
    "client/src/components/CompanyLogo.jsx", "client/src/components/DomainProfileWizard.jsx",   // D61: was ui/CompanyIcon.jsx
    "client/src/components/CoverLetterModal.jsx", "client/src/components/CompanyViewModal.jsx",
    "client/src/panels/DatabasePanel.jsx",   // AtsReportPanel.jsx was here — retired in D152 (8)
    "client/src/panels/JobProfilesPanel.jsx", "client/src/panels/PlansPanel.jsx",
    "client/src/styles/bandStyle.js",
  ];
  for (const f of MIGRATED) {
    assert.ok(fs.existsSync(f), `${f} moved — re-point this list`);
    assert.equal(counts[f] ?? 0, 0, `${f} carries a colour literal again`);
    assert.ok(!(f in BUDGET), `${f} was re-admitted to the budget`);
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// D23 — THE EXTENSION. Same rule, NO budget: extension/ was migrated in one pass (10-04), so any
// colour literal in it fails. Its only token files are the two GENERATED from client/src/styles/
// colorTokens.js by scripts/buildExtensionTokens.mjs — the extension consumes the site's palette, it
// does not keep one. (Their staleness is test/d23ExtensionLook.test.js's job.) Scanned: .js, .css and
// .html, with HTML comments stripped too; extension/submission/ (the built zip, the listing) is not
// source. ⛔ Verified red before it was committed — see the D23 commit message.
// ════════════════════════════════════════════════════════════════════════════════════════════
const EXT_ROOT = "extension";
export const EXT_TOKEN_FILES = new Set(["extension/tokens.css", "extension/tokens.js"]);
// ⭐ T9: extension/atsReport.js is the web app's ATS component BUNDLED from shared/ (scripts/buildAtsReport.mjs): its
// colour values are the generated shared/atsReportTokens.js, and every other line is a shared/ module the client scan
// above already reads. Its staleness is test/t9AtsReportComponent.test.js's job — a hand edit there fails it.
export const EXT_BUNDLED_FROM_SHARED = new Set(["extension/atsReport.js"]);
// ⭐ 46n: extension/tinyMascot.js is shared/tinyMascot.js MIRRORED (Tiny's fox — an illustration, PERMANENT above at an exact
// count). It is skipped only while it is byte-identical to the shared file (line endings aside); an edit here makes it an
// ordinary extension file again, and every literal in it then fails.
export const EXT_MIRRORED_ILLUSTRATION = new Map([["extension/tinyMascot.js", "shared/tinyMascot.js"]]);
const sameText = (a, b) => fs.readFileSync(a, "utf8").replace(/\r\n/g, "\n") === fs.readFileSync(b, "utf8").replace(/\r\n/g, "\n");

function extensionFiles(dir = EXT_ROOT) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "submission") out.push(...extensionFiles(p)); }
    else if (/\.(js|css|html)$/.test(e.name)) out.push(p.split(path.sep).join("/"));
  }
  return out;
}

const stripHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

export function extensionLiteralCounts() {
  const counts = {};
  for (const f of extensionFiles()) {
    if (EXT_TOKEN_FILES.has(f) || EXT_BUNDLED_FROM_SHARED.has(f)) continue;
    if (EXT_MIRRORED_ILLUSTRATION.has(f) && EXT_MIRRORED_ILLUSTRATION.get(f) in PERMANENT && sameText(f, EXT_MIRRORED_ILLUSTRATION.get(f))) continue;
    const n = (stripComments(stripHtmlComments(fs.readFileSync(f, "utf8"))).match(LITERAL) || []).length;
    if (n) counts[f] = n;
  }
  return counts;
}

test("⛔ D23: the extension scan works — it sees the generated token files and every surface", () => {
  const files = extensionFiles();
  // (⭐ T31: popup.html went with the retired toolbar popup; the dock's popups are popup-layer.js)
  for (const f of ["extension/options.html", "extension/popup-layer.js", "extension/review-overlay.js",
                   "extension/extractor.js", "extension/background.js", "extension/ui.css"]) {
    assert.ok(files.includes(f), `the extension walk missed ${f}`);
  }
  for (const f of EXT_TOKEN_FILES) {
    const hits = (stripComments(fs.readFileSync(f, "utf8")).match(LITERAL) || []).length;
    assert.ok(hits >= 60, `the scanner found only ${hits} literals in ${f} — a zero-hit scan is a broken scan`);
  }
  assert.equal((stripHtmlComments('<!-- #123456 --><p style="color:#abcdef">').match(LITERAL) || []).length, 1);
});

test("⛔ D23: no colour literal anywhere in extension/ outside its generated token files — no budget", () => {
  const counts = extensionLiteralCounts();
  assert.deepEqual(Object.entries(counts).map(([f, n]) => `${f}: ${n} literal(s)`), [],
    "a colour literal in the extension. Use var(--c-*) (tokens.css) in a page, or C_LIGHT/C_DARK from " +
    "tokens.js in a worker or an injected function — and if no token fits, add it to the SITE's " +
    "client/src/styles/colorTokens.js and run node scripts/buildExtensionTokens.mjs");
});

export { BUDGET, PERMANENT };
