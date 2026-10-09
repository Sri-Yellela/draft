// ⭐ D83 · THE SIX RULES, checked on every REBUILT admin panel (39d). A panel joins REBUILT when it is rebuilt;
// the rules are then held for it by the code, not by memory. Mutated red and restored per panel.
//   ① the Panel shell with a purpose sentence and the codes behind the ?   ② numbers on open
//   ③ at most one accent (primary) control   ⑤ no browser confirm() / alert() — the in-page useConfirm
//   ⑥ no capsule radius, no free-text box where the code already holds the set (checked by d60 and by review)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCES = ["client/src/panels/adminOps.jsx", "client/src/panels/AdminPanel.jsx"].map(p => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"));

/** The body of `export function Name(` (or `function Name(`) up to the next top-level function. */
export function panelBody(name) {
  for (const src of SOURCES) {
    const m = src.match(new RegExp(`\\n(export )?function ${name}\\(`));
    if (!m) continue;
    const start = m.index + 1, rest = src.slice(start + 1);
    const end = rest.search(/\n(export )?function \w+\(|\n\/\/ ── /);
    return end > 0 ? src.slice(start, start + 1 + end) : src.slice(start);
  }
  throw new Error(`${name} not found`);
}

// name → the parts it is made of (a panel may hand its candidates table to a child that shares its rules)
export const REBUILT = {
  CompaniesSection: ["CompaniesSection", "DiscoveryCandidates"],
  CrawlerTab: ["CrawlerTab"],
  DeploymentsPanel: ["DeploymentsPanel"],
  DiskPanel: ["DiskPanel"],
  CostsTab: ["CostsTab", "SpendPart"],
};

for (const [name, parts] of Object.entries(REBUILT)) {
  test(`D83 rules · ${name}`, () => {
    const head = panelBody(name);
    const all = parts.map(panelBody).join("\n");
    assert.match(head, /<Panel title="[^"]+"/, "① the Panel shell");
    assert.match(head, /\n\s+purpose="[^"]{40,}"/, "① a purpose sentence in plain words");
    assert.match(head, /\n\s+code="[^"]+"/, "① the project codes behind the ?");
    assert.doesNotMatch(head.match(/purpose="([^"]*)"/)[1], /\b[ADO]\d{1,3}\b/, "① no project code in the purpose line");
    assert.match(head, /numbers=\{/, "② numbers on open");
    assert.ok((all.match(/\bprimary\b/g) || []).length <= 1, "③ at most one accent control");
    assert.doesNotMatch(all, /\b(window\.)?(confirm|alert)\(/, "⑤ the browser's confirm()/alert() — use useConfirm");
    for (const p of parts) {
      const body = panelBody(p);
      if (/\bask\(/.test(body)) assert.match(body, /const \{ ask, dialog \} = useConfirm\(\);/, `⑤ ${p} asks without its own in-page confirm`);
      if (/\bask\(/.test(body)) assert.match(body, /\{dialog\}/, `⑤ ${p} never draws its confirm`);
    }
    assert.doesNotMatch(all, /999px|borderRadius: "50%"|rounded-full/, "⑥ no capsule");
  });
}
