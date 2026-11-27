// ⭐ A157 (45s walk) · the in-app company page must survive App.jsx's route guard. The guard sends any address it does not
// know to the board; companyRoute was missing from it (since D179 P4b, 45l), so every /app/companies/<slug> — a company's
// name, its logo, a search pick — bounced to /app/jobs for a signed-in person. Found by scripts/walk45s.mjs (real Chrome).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("client/src/App.jsx", "utf8").replace(/\r\n/g, "\n");

test("a157InAppCompanyRoute: every routed place the shell draws is excused from the bounce-to-board guard", () => {
  const at = (a, from = 0) => { const i = app.indexOf(a, from); assert.ok(i >= 0, `anchor missing: ${a}`); return i; };
  const from = at("if (!jobRoute && ");
  const guard = app.slice(from, at("navigate(consolePath, { replace:true });", from));
  assert.ok(guard.length > 0 && guard.length < 400);
  for (const r of ["!jobRoute", "!atlasRoute", "!companyRoute", "profilePanel === undefined", "interviewPanel === undefined"])
    assert.ok(guard.includes(r), `the guard excuses ${r}`);
  assert.match(app, /activeTab === "company" && companyRoute && <AreaErrorBoundary area="company" \{\.\.\.areaGuard\}><CompanyPage/);
  assert.match(app, /\}, \[routeKey, consolePath, navigate, NAVIGABLE_TABS, atlasRoute, companyRoute,/);
});

test("a148ScopedSearchPicksOnlyItsKind (owner 11-09): with a label on, only that kind is listed, and Enter opens it — never a board text search", () => {
  const u = fs.readFileSync("client/src/components/UsbSuggest.jsx", "utf8").replace(/\r\n/g, "\n");
  assert.match(u, /\]\.filter\(\(row\) => !\(grouped && scope\) \|\| row\.kind === scope\);/);
  assert.match(u, /if \(e\.key === "Enter" && grouped && scope\) \{\n      e\.preventDefault\(\);\n      const pick = \(active >= 0 && items\[active\]\) \|\| items\[0\];\n      if \(pick\) accept\(pick\);\n      return;\n    \}/);
});
