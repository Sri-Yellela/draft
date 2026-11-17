// ⭐ A230 (46t) · THREE ENDPOINTS WITH NO CALLER, DELETED. A228's skill map replaced the screens that read them: Compare roles
// (/api/atlas/readiness/compare), the For a role picker (/api/atlas/subcategory-roles — a whole-board GROUP BY on the
// request path) and Your skills' ring map (/api/your-skills/map). Every caller was checked first (client, extension, scripts,
// tests); /api/atlas/readiness and subcategoryReadiness stay (Profile and Today's question use roleReadiness).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const DEAD = ["/api/atlas/readiness/compare", "/api/atlas/subcategory-roles", "/api/your-skills/map"];

test("A230: the three routes and their only readers are gone", () => {
  const atlas = read("routes/atlas.js"), ys = read("routes/yourSkills.js");
  assert.doesNotMatch(atlas, /router\.get\("\/readiness\/compare"/);
  assert.doesNotMatch(atlas, /router\.get\("\/subcategory-roles"/);
  assert.doesNotMatch(ys, /router\.get\("\/map"/);
  assert.doesNotMatch(read("services/atlas/roleReadiness.js"), /export function (compareRoles|compareFrom)\b/);
  assert.doesNotMatch(read("services/yourSkills.js"), /export function yourSkillsMap\b/);
  // what stays
  assert.match(atlas, /router\.get\("\/readiness", /);
  assert.match(atlas, /router\.get\("\/skill-map", /);
});

test("A230: nothing in the client, the extension or the scripts asks for them", () => {
  const walk = (d) => fs.readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? (["node_modules", "dist"].includes(e.name) ? [] : walk(`${d}/${e.name}`)) : /\.(m?js|jsx)$/.test(e.name) ? [`${d}/${e.name}`] : []);
  for (const f of [...walk("client/src"), ...walk("extension"), ...walk("scripts")]) {
    const s = read(f);
    for (const p of DEAD) assert.ok(!s.includes(p), `${f} still names ${p}`);
  }
});

// ⭐ 46t (carried from 46r): "you've proven N of their top M" — ONE cut for the company page and the extension's facts.
test("one top-M cut: the extension's posting facts use the company page's COMPANY_MATCH_TOP", async () => {
  const { COMPANY_MATCH_TOP } = await import("../services/companies/publicCompany.js");
  assert.equal(COMPANY_MATCH_TOP, 12);
  const ext = read("services/extensionJobFacts.js");
  assert.match(ext, /companyMatchFor\(db, slug, userId, \{ yourSkillStates \}\)/);
  assert.doesNotMatch(ext, /top: \d+/);
});
