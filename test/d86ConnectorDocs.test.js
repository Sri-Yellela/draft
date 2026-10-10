// D86 §6 (docs/CLAUDE_CONNECTOR_COMPLIANCE.md): the reviewer package's public pages — /docs/claude, security.txt and
// the Terms sections the compliance document requires. Each assertion is red when its page drifts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TOOL_DEFS } from "../services/byom/tools.js";
import { securityTxt, SECURITY_TXT_DAYS } from "../services/securityTxt.js";
import { SECURITY_EMAIL } from "../shared/brand.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const DOCS = "client/src/pages/marketing/ConnectorDocsPage.jsx";

test("⛔ D86 §6: /docs/claude lists exactly the tools the connector serves, and is routed", () => {
  const src = read(DOCS);
  const listed = [...src.matchAll(/^\s*\["(draft_[a-z_]+)"/gm)].map(m => m[1]);
  assert.deepEqual(listed.sort(), TOOL_DEFS.map(d => d.name).sort(), "the docs page and tools/list disagree");
  assert.match(read("client/src/App.jsx"), /<Route path="\/docs\/claude"\s+element={<ConnectorDocsPage\/>}\/>/);
});

test("⛔ D86 §6: /docs/claude covers what the directory asks for — and advertises nothing (DR-7)", () => {
  const src = read(DOCS);
  for (const [what, re] of [
    ["who it is for", /Who it is for/], ["setup", /id="setup"/], ["what is stored and for how long", /12 months/],
    ["who processes it", /your own Claude account and Anthropic's terms/], ["the daily limit", /BYO_DAILY_CAP_DEFAULT/],
    ["troubleshooting", /id="troubleshooting"/], ["the AI-assistance notice", /Some employers restrict AI-assisted applications/],
    ["disconnect", /id="disconnect"/], ["a security contact", /SECURITY_EMAIL/], ["no training", /never uses this content to train a model/],
  ]) assert.match(src, re, `the docs page is missing ${what}`);
  const prose = src.replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(prose, /\b(?:upgrade|premium|pro plan|pricing|subscribe|subscription|free trial|discount|checkout)\b|\$\s?\d/i);
});

test("⛔ D86 §6: security.txt carries Contact and an Expires under a year away (RFC 9116), and is served", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const txt = securityTxt(now);
  assert.match(txt, new RegExp(`^Contact: mailto:${SECURITY_EMAIL.replace(".", "\\.")}$`, "m"));
  const exp = new Date(txt.match(/^Expires: (.+)$/m)[1]);
  assert.equal(Math.round((exp - now) / 86400_000), SECURITY_TXT_DAYS);
  assert.ok(SECURITY_TXT_DAYS < 365);
  assert.match(txt, /^Canonical: https:\/\/jobsviadraft\.com\/\.well-known\/security\.txt$/m);
  const server = read("server.js");
  const route = server.indexOf('app.get("/.well-known/security.txt"');
  assert.ok(route > 0, "the route exists");
  assert.ok(route < server.indexOf('app.get("*"'), "it is mounted before the SPA fallback");
});

test("⛔ D86 §4: the Terms say 18+, applicants only, true content only, and AI-assisted", () => {
  const src = read("client/src/pages/marketing/TermsPage.jsx");
  assert.match(src, /at least 18 years old/);
  assert.match(src, /may not use it to screen, rank, assess or make decisions about other people/);
  assert.match(src, /may not use the service to invent or overstate experience/);
  assert.match(src, /Some employers restrict AI-assisted applications/);
});
