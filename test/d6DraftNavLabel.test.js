// D6 (10-03) — the nav says DRAFT, with the /d mark, and no user-visible string says "Auto Apply".
//
// The product's verb is draft, the brand is draft, the card's primary button says Draft — and the
// top bar said AUTO APPLY. Two names for one action teach two mental models (A53's rule). This guard
// keeps the second name from coming back through any display string.
//
// ⛔ DISPLAY STRINGS ONLY. Identifiers, routes and table names stay (docs/BRAND.md "What does NOT
// change"): `AutoApplyPanel`, `useAutoApply`, the `auto-apply` tab id and `/app/auto-apply` route,
// `applyAutomation.js`, `autoApply()`. So the scan skips comments, matches the NAME — "Auto Apply" /
// "Auto-Apply" / "AUTO APPLY", case-sensitive — and lets a lowercase `auto-apply` through only as an
// id or a route, or in the one allowlisted sentence below.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// Comments are where the internal name legitimately lives (they describe the code). Strip block
// comments (which covers JSX's {/* */}) and line comments. A `//` inside a string (a URL) loses the
// rest of its line — that can only HIDE a hit, never invent one, and no display string here holds
// both a URL and the feature's name.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ""))   // keep the newlines: line numbers stay true
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

// The NAME, as a reader sees it — title or upper case, two words. A bare identifier (AutoApply,
// autoApply) has no separator and does not match. Scanned in the client, the server's routes and
// services, server.js and the extension.
const NAME = /Auto[ -]Apply|AUTO[ -]APPLY/;
// The lowercase verb, scanned in the CLIENT (what a user reads). Server-side it survives in the run
// log's technical lines about full-auto submission and in the mobile contract's developer
// descriptions — neither is the nav feature's name (sweep record, D6).
const LOWER = /auto[ -]apply/g;
const LOWER_OK = [
  /^auto-apply$/,                   // the tab id (internal)
  /^\/app\/auto-apply$/,            // the route (internal)
];
// ⭐ The ONE prose use kept on purpose, with its reason. Each entry must still match (self-pruning).
const PROSE_ALLOWLIST = [
  { file: "client/src/pages/marketing/FAQPage.jsx", text: "auto-apply to jobs on my behalf?",
    why: "the FAQ asks the question in the words a visitor would search with; the answer teaches Draft" },
];

const tracked = (globs) =>
  execFileSync("git", ["ls-files", "--", ...globs], { encoding: "utf8" }).split("\n").filter(Boolean);

test("D6/D18: the nav tab DISPLAYS Draft House — its id and route stay auto-apply", () => {
  const app = read("client/src/App.jsx");
  assert.match(app, /\{ id: "auto-apply",\s*label: "Draft House" \}/);
  assert.doesNotMatch(app, /label: "Auto Apply"/);
});

test("D6/D18: the /d mark is ONE implementation on the card — and D18 took it OFF the tab", () => {
  const app = read("client/src/App.jsx");
  const bubble = read("client/src/components/JobBubble.jsx");
  const mark = read("client/src/components/DraftMark.jsx");
  assert.match(app, /import \{ DraftMark \}\s+from "\.\/components\/DraftMark\.jsx";/);
  // D18 (owner, 10-03) REVERSES D6 here: no tab carries a symbol. The import stays for the board's Pending chip (D11).
  assert.doesNotMatch(app, /t\.id === "auto-apply"[\s\S]{0,400}<DraftMark /, "the Draft House tab renders the mark again (D18: no symbol on any tab)");
  assert.match(bubble, /<DraftMark \/>/, "the card's Draft button no longer renders the shared mark");
  // The mark is decorative (the word or the button's aria-label names the action), and it must not be
  // uppercased by the tab row's text-transform — "/D" is not the mark.
  assert.match(mark, /aria-hidden="true"/);
  assert.match(mark, /textTransform: "none"/);
  assert.match(mark, /'Poppins'/);
  // No second copy of the glyphs as the card's or the tab's content.
  assert.doesNotMatch(bubble, />\s*\/d\s*</);
});

test("D6: the badge says what it counts — drafts that need you, not drafts", () => {
  const app = read("client/src/App.jsx");
  assert.match(app, /needsAttentionCount === 1 \? "draft needs" : "drafts need"\} your attention/);
  // The bare digit is hidden from the accessible name; the sentence is what a screen reader hears.
  // ⭐ D145 (changed on purpose): the count is data on the tab (badge + badgeLabel); AppNav draws it the same way.
  assert.match(app, /badge: needsAttentionCount, badgeLabel: attention/);
  const nav = read("client/src/components/AppNav.jsx");
  assert.match(nav, /<span aria-hidden="true">\{t\.badge\}<\/span><span className="sr-only">\{`, \$\{t\.badgeLabel\}`\}<\/span>/);
});

test("D6: no user-visible string in the client, server routes or extension says Auto Apply", () => {
  const files = tracked(["client/src", "routes", "services", "server.js", "extension"])
    .filter(f => /\.(jsx?|mjs|html|json)$/.test(f) && !/\.min\.js$/.test(f));
  assert.ok(files.length > 100, `the scan sees only ${files.length} files — git ls-files is not seeing the tree`);
  const hits = [];
  for (const f of files) {
    const src = stripComments(read(f));
    src.split("\n").forEach((line, i) => {
      if (NAME.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`);
      for (const m of line.matchAll(LOWER)) {
        // Widen to the surrounding token so an id ("auto-apply") or a route can be recognised.
        const s = line.slice(0, m.index).match(/[^\s(){},=]*$/)[0];
        const e = line.slice(m.index + m[0].length).match(/^[^\s(){},;]*/)[0];
        const token = (s + m[0] + e).replace(/^["'`]+|["'`]+$/g, "");
        if (!f.startsWith("client/src/")) break;
        if (LOWER_OK.some(r => r.test(token))) continue;
        if (PROSE_ALLOWLIST.some(a => a.file === f && line.includes(a.text))) continue;
        hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`);
      }
    });
  }
  assert.deepEqual(hits, [], "the feature's old name is back in a display string — it is DRAFT (D6):\n" + hits.join("\n"));
});

test("D6: every prose allowlist entry still matches (self-pruning)", () => {
  for (const a of PROSE_ALLOWLIST) {
    assert.ok(read(a.file).includes(a.text), `${a.file} no longer says "${a.text}" — remove the entry (${a.why})`);
  }
});
