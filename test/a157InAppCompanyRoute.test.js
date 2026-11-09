// ⭐ A157 (45s walk) · the in-app company page must survive App.jsx's route guard. The guard sends any address it does not
// know to the board; companyRoute was missing from it (since D179 P4b, 45l), so every /app/companies/<slug> — a company's
// name, its logo, a search pick — bounced to /app/jobs for a signed-in person. Found by scripts/walk45s.mjs (real Chrome).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("client/src/App.jsx", "utf8").replace(/\r\n/g, "\n");

test("a157InAppCompanyRoute: every routed place the shell draws is excused from the bounce-to-board guard", () => {
  const guard = app.match(/if \((!jobRoute[^)]*?)\)\s*\{\s*navigate\(consolePath, \{ replace:true \}\);/);
  assert.ok(guard, "the guard is where it was");
  for (const r of ["!jobRoute", "!atlasRoute", "!companyRoute", "profilePanel === undefined", "interviewPanel === undefined"])
    assert.ok(guard[1].includes(r), `the guard excuses ${r}`);
  assert.match(app, /activeTab === "company" && companyRoute && <CompanyPage/);
  assert.match(app, /\}, \[routeKey, consolePath, navigate, NAVIGABLE_TABS, atlasRoute, companyRoute,/);
});
